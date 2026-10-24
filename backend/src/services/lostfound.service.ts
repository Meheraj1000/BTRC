import type { LostFoundClaimStatus, LostFoundItemKind, LostFoundStatus, Prisma, RoleCode } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";
import { broadcastLostFound, emitToUser } from "../lib/socket.js";
import { notifyCompanyOwner, notifyRoles, notifyUser } from "./notification.service.js";
import { hasPermission } from "../utils/permissions.js";
import { assertPolicePlace, placeRecordFilter, policeCityScope } from "../utils/policeArea.js";
import { ownerCompanyId, pagination } from "../utils/scope.js";

const LF_INCLUDE = {
  reporter: { select: { id: true, fullName: true } },
  bus: { select: { id: true, registrationNo: true, companyId: true, routeId: true, route: { select: { city: true } } } },
  route: { select: { id: true, code: true, name: true, companyId: true, city: true } },
  driver: { select: { id: true, user: { select: { fullName: true } } } },
  trip: { select: { id: true, busId: true, routeId: true } },
  claimedBy: { select: { id: true, fullName: true } },
  decidedBy: { select: { id: true, fullName: true } },
  matchedItem: { select: { id: true, reference: true, kind: true, category: true, title: true } },
  matches: { select: { id: true, reference: true, kind: true, category: true, title: true, status: true } },
} satisfies Prisma.LostFoundItemInclude;

type LostFoundRow = Prisma.LostFoundItemGetPayload<{ include: typeof LF_INCLUDE }>;

function isPassenger(roles: RoleCode[]) {
  return roles.includes("PASSENGER") && !roles.some((r) => ["SUPER_ADMIN", "GOVERNMENT", "TRANSPORT_OWNER", "BRTA", "POLICE"].includes(r));
}

function isOwner(roles: RoleCode[]) {
  return roles.includes("TRANSPORT_OWNER");
}

function isReporterAllowed(roles: RoleCode[], kind: LostFoundItemKind) {
  if (kind === "LOST") return true;
  return roles.some((role) => ["PASSENGER", "DRIVER", "TRANSPORT_OWNER", "SUPER_ADMIN", "GOVERNMENT", "POLICE"].includes(role));
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function scoreMatch(source: LostFoundRow, candidate: LostFoundRow) {
  let score = 0;
  if (source.category === candidate.category) score += 40;
  if (source.busId && candidate.busId && source.busId === candidate.busId) score += 25;
  if (source.routeId && candidate.routeId && source.routeId === candidate.routeId) score += 20;
  if (source.locationText && candidate.locationText && source.locationText.toLowerCase() === candidate.locationText.toLowerCase()) score += 8;
  const sourceWords = new Set(normalize(`${source.title} ${source.description} ${source.locationText ?? ""}`));
  const candidateWords = normalize(`${candidate.title} ${candidate.description} ${candidate.locationText ?? ""}`);
  for (const word of candidateWords) if (sourceWords.has(word)) score += 3;
  if (source.lostAt && candidate.foundAt) {
    const ageMs = Math.abs(candidate.foundAt.getTime() - source.lostAt.getTime());
    if (ageMs < 24 * 60 * 60 * 1000) score += 10;
    else if (ageMs < 72 * 60 * 60 * 1000) score += 5;
  }
  return score;
}

function projectItem(row: LostFoundRow, view: "passenger" | "monitor") {
  const base = {
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    claimStatus: row.claimStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lostAt: row.lostAt,
    foundAt: row.foundAt,
    locationText: row.locationText,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    busId: row.busId,
    routeId: row.routeId,
    driverId: row.driverId,
    tripId: row.tripId,
    busRegistrationNo: row.bus?.registrationNo ?? null,
    routeCode: row.route?.code ?? null,
    routeName: row.route?.name ?? null,
    reporterRole: row.reporterRole,
    matchedItem: row.matchedItem,
    matchCount: row.matches?.length ?? 0,
  };
  if (view === "passenger") {
    return {
      ...base,
      reporterName: null,
      internalNote: null,
      claimEvidence: null,
      claimNote: null,
      claimedByName: null,
      decidedByName: null,
      potentialMatches: (row.matches ?? []).slice(0, 3).map((match) => ({
        id: match.id,
        reference: match.reference,
        kind: match.kind,
        category: match.category,
        title: match.title,
        status: match.status,
      })),
    };
  }
  return {
    ...base,
    reporterName: row.reporter.fullName,
    internalNote: row.internalNote,
    claimEvidence: row.claimEvidence,
    claimNote: row.claimNote,
    claimedByName: row.claimedBy?.fullName ?? null,
    decidedByName: row.decidedBy?.fullName ?? null,
    potentialMatches: (row.matches ?? []).map((match) => ({
      id: match.id,
      reference: match.reference,
      kind: match.kind,
      category: match.category,
      title: match.title,
      status: match.status,
    })),
  };
}

async function loadItem(id: string) {
  const row = await prisma.lostFoundItem.findUnique({ where: { id }, include: LF_INCLUDE });
  if (!row) throw new ApiError("Lost & Found item not found", 404);
  return row;
}

async function notifyCreated(row: LostFoundRow) {
  await notifyUser({
    userId: row.reporterId,
    type: "LOST_FOUND",
    title: `${row.kind === "LOST" ? "Lost item" : "Found item"} recorded`,
    body: "Your report was saved in the application workflow.",
    payload: {
      itemId: row.id,
      status: row.status,
      busId: row.busId,
      routeId: row.routeId,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
    },
  });
  await notifyRoles(["SUPER_ADMIN", "GOVERNMENT", "POLICE"], {
    type: "LOST_FOUND",
    title: "New Lost & Found report",
    body: `${row.kind} report submitted`,
    payload: {
      itemId: row.id,
      status: row.status,
      busId: row.busId,
      routeId: row.routeId,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
    },
  });
  const companyId = row.bus?.companyId ?? row.route?.companyId ?? undefined;
  await notifyCompanyOwner(companyId, {
    type: "LOST_FOUND",
    title: "New Lost & Found report",
    body: `${row.kind} report submitted`,
    payload: { itemId: row.id, status: row.status },
  });
}

async function notifyChanged(row: LostFoundRow, previous: LostFoundStatus) {
  await notifyUser({
    userId: row.reporterId,
    type: "LOST_FOUND",
    title: `${row.kind} item ${row.status.toLowerCase()}`,
    body: `Your report changed from ${previous} to ${row.status}.`,
    payload: { itemId: row.id, status: row.status, claimStatus: row.claimStatus },
  });
}

function emitItem(row: LostFoundRow) {
  const passengerView = projectItem(row, "passenger");
  const monitorView = projectItem(row, "monitor");
  try {
    emitToUser(row.reporterId, "lostfound:update", passengerView);
    broadcastLostFound(
      monitorView,
      row.bus?.companyId ?? row.route?.companyId ?? undefined,
      row.route?.city ?? row.bus?.route?.city ?? null,
    );
  } catch {
    // sockets may be unavailable in tests
  }
}

function transitionAllowed(current: LostFoundStatus, next: LostFoundStatus) {
  const allowed: Record<LostFoundStatus, LostFoundStatus[]> = {
    LOST: ["MATCHED", "CANCELLED"],
    FOUND: ["MATCHED", "CANCELLED"],
    MATCHED: ["CLAIM_PENDING", "CANCELLED"],
    CLAIM_PENDING: ["RETURNED", "MATCHED", "CANCELLED"],
    RETURNED: ["CLOSED"],
    CLOSED: [],
    CANCELLED: [],
  };
  return allowed[current]?.includes(next) ?? false;
}

async function listCandidates(item: LostFoundRow) {
  const oppositeKind: LostFoundItemKind = item.kind === "LOST" ? "FOUND" : "LOST";
  const rows = await prisma.lostFoundItem.findMany({
    where: {
      kind: oppositeKind,
      status: { in: ["LOST", "FOUND", "MATCHED", "CLAIM_PENDING"] },
      id: { not: item.id },
    },
    include: LF_INCLUDE,
    take: 25,
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map((candidate) => ({ candidate, score: scoreMatch(item, candidate) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ candidate, score }) => ({
      id: candidate.id,
      reference: candidate.reference,
      kind: candidate.kind,
      category: candidate.category,
      title: candidate.title,
      status: candidate.status,
      score,
    }));
}

export async function createItem(input: {
  userId: string;
  roles: RoleCode[];
  kind: LostFoundItemKind;
  category: string;
  title: string;
  description: string;
  busId?: string;
  routeId?: string;
  driverId?: string;
  tripId?: string;
  lostAt?: string;
  foundAt?: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
}) {
  if (!isReporterAllowed(input.roles, input.kind)) {
    throw new ApiError("You cannot create this report", 403);
  }
  const created = await prisma.lostFoundItem.create({
    data: {
      reference: `LF-${Date.now()}-${randomUUID().slice(0, 8)}`,
      kind: input.kind,
      category: input.category,
      title: input.title,
      description: input.description,
      reporterId: input.userId,
      reporterRole: input.roles[0] ?? "PASSENGER",
      busId: input.busId,
      routeId: input.routeId,
      driverId: input.driverId,
      tripId: input.tripId,
      lostAt: input.lostAt ? new Date(input.lostAt) : null,
      foundAt: input.foundAt ? new Date(input.foundAt) : null,
      locationText: input.locationText,
      latitude: input.latitude,
      longitude: input.longitude,
      status: input.kind === "LOST" ? "LOST" : "FOUND",
    },
    include: LF_INCLUDE,
  });
  await notifyCreated(created);
  emitItem(created);
  const matches = await listCandidates(created);
  return { ...projectItem(created, isPassenger(input.roles) ? "passenger" : "monitor"), potentialMatches: matches };
}

export async function listItems(req: Request) {
  const roles = req.user!.roles;
  const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
  const companyId = await ownerCompanyId(req);
  const where: Prisma.LostFoundItemWhereInput = {
    ...(roles.includes("PASSENGER") ? { reporterId: req.user!.id } : {}),
    ...(isOwner(roles) ? companyId ? { OR: [{ bus: { companyId } }, { route: { companyId } }] } : {} : {}),
  };
  const cities = await policeCityScope(req);
  if (cities) where.AND = [placeRecordFilter(cities)];
  if (typeof req.query.kind === "string" && req.query.kind) {
    if (!["LOST", "FOUND"].includes(req.query.kind)) throw new ApiError("Invalid item kind", 422);
    where.kind = req.query.kind as LostFoundItemKind;
  }
  if (typeof req.query.status === "string" && req.query.status) {
    if (!["LOST", "FOUND", "MATCHED", "CLAIM_PENDING", "RETURNED", "CLOSED", "CANCELLED"].includes(req.query.status)) {
      throw new ApiError("Invalid item status", 422);
    }
    where.status = req.query.status as LostFoundStatus;
  }
  if (typeof req.query.category === "string" && req.query.category) {
    where.category = { contains: req.query.category, mode: "insensitive" };
  }
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { locationText: { contains: q, mode: "insensitive" } },
      { bus: { registrationNo: { contains: q, mode: "insensitive" } } },
      { route: { code: { contains: q, mode: "insensitive" } } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.lostFoundItem.findMany({ where, include: LF_INCLUDE, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.lostFoundItem.count({ where }),
  ]);
  return {
    items: rows.map((row) => projectItem(row, roles.includes("PASSENGER") ? "passenger" : "monitor")),
    page,
    pageSize,
    total,
    dataLabel: "APPLICATION WORKFLOW — not a live lost-and-found database",
  };
}

export async function getItem(req: Request, id: string) {
  const row = await loadItem(id);
  const roles = req.user!.roles;
  const passenger = roles.includes("PASSENGER");
  const companyId = await ownerCompanyId(req);
  if (passenger && row.reporterId !== req.user!.id) {
    throw new ApiError("You cannot access another user's lost/found report", 403);
  }
  if (isOwner(roles) && companyId && row.bus?.companyId !== companyId && row.route?.companyId !== companyId) {
    throw new ApiError("You cannot access another operator's lost/found report", 403);
  }
  if (!passenger && !hasPermission(roles, "lostfound.read")) {
    throw new ApiError("Insufficient permission", 403);
  }
  await assertPolicePlace(req, {
    busId: row.busId,
    routeId: row.routeId,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
  });
  const matches = await listCandidates(row);
  return { ...projectItem(row, passenger ? "passenger" : "monitor"), potentialMatches: matches };
}

async function assertItemPlace(req: Request | undefined, id: string) {
  if (!req) return;
  const row = await loadItem(id);
  await assertPolicePlace(req, {
    busId: row.busId,
    routeId: row.routeId,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
  });
}

export async function matchItem(id: string, matchedItemId: string, actorId: string, req?: Request) {
  await assertItemPlace(req, id);
  const row = await loadItem(id);
  const match = await loadItem(matchedItemId);
  if (row.kind === match.kind) throw new ApiError("Match requires opposite item kinds", 422);
  if (!transitionAllowed(row.status, "MATCHED") || !transitionAllowed(match.status, "MATCHED")) {
    throw new ApiError("Items cannot be matched in their current state", 422);
  }
  const [updated, updatedMatch] = await prisma.$transaction([
    prisma.lostFoundItem.update({ where: { id }, data: { matchedItemId, status: "MATCHED", decidedById: actorId }, include: LF_INCLUDE }),
    prisma.lostFoundItem.update({ where: { id: matchedItemId }, data: { matchedItemId: id, status: "MATCHED", decidedById: actorId }, include: LF_INCLUDE }),
  ]);
  await notifyChanged(updated, row.status);
  await notifyChanged(updatedMatch, match.status);
  emitItem(updated);
  emitItem(updatedMatch);
  return { item: projectItem(updated, "monitor"), matchedItem: projectItem(updatedMatch, "monitor") };
}

export async function claimItem(id: string, actorId: string, claimNote: string, claimEvidence?: string) {
  const row = await loadItem(id);
  if (!transitionAllowed(row.status, "CLAIM_PENDING")) throw new ApiError("This item cannot be claimed in its current state", 422);
  const updated = await prisma.lostFoundItem.update({
    where: { id },
    data: {
      claimedById: actorId,
      claimNote,
      claimEvidence,
      claimStatus: "PENDING",
      status: "CLAIM_PENDING",
      claimedAt: new Date(),
    },
    include: LF_INCLUDE,
  });
  await notifyUser({
    userId: actorId,
    type: "LOST_FOUND",
    title: "Claim submitted",
    body: "Your claim is awaiting review.",
    payload: { itemId: id, status: updated.status },
  });
  emitItem(updated);
  return projectItem(updated, "passenger");
}

export async function reviewClaim(id: string, decision: LostFoundClaimStatus, actorId: string, req?: Request) {
  await assertItemPlace(req, id);
  const row = await loadItem(id);
  if (row.status !== "CLAIM_PENDING") throw new ApiError("No claim is awaiting review", 422);
  if (!row.claimedById) throw new ApiError("No claimant is attached", 422);
  const nextStatus = decision === "APPROVED" ? "RETURNED" : "MATCHED";
  const updated = await prisma.lostFoundItem.update({
    where: { id },
    data: {
      claimStatus: decision,
      status: nextStatus,
      decidedById: actorId,
      returnedAt: decision === "APPROVED" ? new Date() : row.returnedAt,
    },
    include: LF_INCLUDE,
  });
  await notifyChanged(updated, row.status);
  emitItem(updated);
  return projectItem(updated, "monitor");
}

export async function closeItem(id: string, actorId: string, req?: Request) {
  await assertItemPlace(req, id);
  const row = await loadItem(id);
  if (!transitionAllowed(row.status, "CLOSED")) throw new ApiError("This item cannot be closed now", 422);
  const updated = await prisma.lostFoundItem.update({ where: { id }, data: { status: "CLOSED", decidedById: actorId }, include: LF_INCLUDE });
  emitItem(updated);
  return projectItem(updated, "monitor");
}

export async function cancelItem(req: Request, id: string) {
  const row = await loadItem(id);
  if (row.reporterId !== req.user!.id) throw new ApiError("You can only cancel your own report", 403);
  if (!["LOST", "FOUND"].includes(row.status)) throw new ApiError("Only an open report can be cancelled", 422);
  const updated = await prisma.lostFoundItem.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() }, include: LF_INCLUDE });
  await notifyChanged(updated, row.status);
  emitItem(updated);
  return projectItem(updated, isPassenger(req.user!.roles) ? "passenger" : "monitor");
}
