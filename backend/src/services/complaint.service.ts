import type { ComplaintCategory, ComplaintPriority, ComplaintStatus, Prisma, RoleCode } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";
import { broadcastComplaint, emitToUser } from "../lib/socket.js";
import { notifyCompanyOwner, notifyRoles, notifyUser } from "./notification.service.js";
import { hasPermission } from "../utils/permissions.js";
import { assertPolicePlace, placeRecordFilter, policeCityScope } from "../utils/policeArea.js";
import { pagination, ownerCompanyId } from "../utils/scope.js";

const COMPLAINT_INCLUDE = {
  passenger: { select: { id: true, fullName: true } },
  bus: { select: { id: true, registrationNo: true, companyId: true, routeId: true, route: { select: { city: true } } } },
  driver: { select: { id: true, user: { select: { fullName: true } } } },
  route: { select: { id: true, code: true, name: true, companyId: true, city: true } },
  trip: { select: { id: true, busId: true, routeId: true } },
  resolver: { select: { id: true, fullName: true } },
  assignee: { select: { id: true, fullName: true } },
} satisfies Prisma.ComplaintInclude;

type ComplaintRow = Prisma.ComplaintGetPayload<{ include: typeof COMPLAINT_INCLUDE }>;

function isPassenger(roles: RoleCode[]) {
  return roles.includes("PASSENGER") && !roles.some((r) => ["SUPER_ADMIN", "GOVERNMENT", "TRANSPORT_OWNER", "BRTA", "POLICE"].includes(r));
}

function isMonitor(roles: RoleCode[]) {
  return hasPermission(roles, "complaints.read");
}

function isOwner(roles: RoleCode[]) {
  return roles.includes("TRANSPORT_OWNER");
}

function scopeWhere(companyId?: string) {
  return companyId
    ? {
        OR: [
          { bus: { companyId } },
          { route: { companyId } },
        ],
      }
    : undefined;
}

function mapStatus(status: ComplaintStatus) {
  if (status === "PENDING") return "OPEN";
  if (status === "UNDER_REVIEW") return "ACKNOWLEDGED";
  if (status === "RESOLVED") return "RESOLVED";
  return "REJECTED";
}

function activeTransitions(status: ComplaintStatus): ComplaintStatus[] {
  if (status === "PENDING") return ["UNDER_REVIEW", "REJECTED"];
  if (status === "UNDER_REVIEW") return ["RESOLVED", "REJECTED"];
  return [];
}

function projectComplaint(row: ComplaintRow, view: "passenger" | "monitor") {
  const base = {
    id: row.id,
    reference: row.reference,
    category: row.category,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    resolution: row.resolution,
    busId: row.busId,
    driverId: row.driverId,
    routeId: row.routeId,
    tripId: row.tripId,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    busRegistrationNo: row.bus?.registrationNo ?? null,
    routeCode: row.route?.code ?? null,
    routeName: row.route?.name ?? null,
    driverName: row.driver?.user.fullName ?? null,
    assigneeName: row.assignee?.fullName ?? null,
    resolverName: row.resolver?.fullName ?? null,
  };
  if (view === "passenger") {
    return {
      ...base,
      passengerName: null,
      internalNote: null,
      assignedToName: null,
    };
  }
  return {
    ...base,
    passengerId: row.passengerId,
    passengerName: row.passenger.fullName,
    internalNote: row.internalNote,
    assignedToName: row.assignee?.fullName ?? null,
  };
}

async function loadComplaint(id: string) {
  const row = await prisma.complaint.findUnique({ where: { id }, include: COMPLAINT_INCLUDE });
  if (!row) throw new ApiError("Complaint not found", 404);
  return row;
}

async function notifyCreated(row: ComplaintRow) {
  const payload = {
    complaintId: row.id,
    status: row.status,
    busId: row.busId ?? row.bus?.id ?? null,
    registrationNo: row.bus?.registrationNo ?? null,
    driverId: row.driverId ?? null,
    routeId: row.routeId ?? row.route?.id ?? null,
    priority: row.priority,
    source: row.priority === "CRITICAL" || String(row.reference ?? "").startsWith("EMG-")
      ? "QR_EMERGENCY"
      : "COMPLAINT",
  };
  await notifyUser({
    userId: row.passengerId,
    type: "COMPLAINT_UPDATE",
    title: "Complaint received",
    body: "Your complaint was recorded in the application workflow.",
    payload,
  });
  await notifyRoles(["SUPER_ADMIN", "GOVERNMENT", "POLICE"], {
    type: "COMPLAINT_UPDATE",
    title: "New complaint",
    body: row.bus?.registrationNo
      ? `${row.category} on ${row.bus.registrationNo}. Open the notice for bus, driver, and live location.`
      : `${row.category} complaint submitted`,
    payload,
  });
  const companyId = row.bus?.companyId ?? row.route?.companyId ?? undefined;
  await notifyCompanyOwner(companyId, {
    type: "COMPLAINT_UPDATE",
    title: "New complaint",
    body: row.bus?.registrationNo
      ? `${row.category} on ${row.bus.registrationNo}. Open the notice for details.`
      : `${row.category} complaint submitted`,
    payload,
  });
}

async function notifyUpdated(row: ComplaintRow, previous: ComplaintStatus) {
  await notifyUser({
    userId: row.passengerId,
    type: "COMPLAINT_UPDATE",
    title: `Complaint ${row.status.toLowerCase()}`,
    body: `Your complaint changed from ${previous} to ${row.status}.`,
    payload: { complaintId: row.id, status: row.status },
  });
  const companyId = row.bus?.companyId ?? row.route?.companyId ?? undefined;
  if (companyId) {
    await notifyCompanyOwner(companyId, {
      type: "COMPLAINT_UPDATE",
      title: "Complaint update",
      body: `Complaint ${row.reference} is now ${row.status}`,
      payload: { complaintId: row.id, status: row.status },
    });
  }
}

function emitComplaint(row: ComplaintRow) {
  const passengerView = projectComplaint(row, "passenger");
  const monitorView = projectComplaint(row, "monitor");
  try {
    emitToUser(row.passengerId, "complaint:update", passengerView);
    broadcastComplaint(
      monitorView,
      row.bus?.companyId ?? row.route?.companyId ?? undefined,
      row.route?.city ?? row.bus?.route?.city ?? null,
    );
  } catch {
    // sockets may be unavailable in tests
  }
}

export async function createComplaint(input: {
  passengerId: string;
  busId?: string;
  driverId?: string;
  routeId?: string;
  tripId?: string;
  category: ComplaintCategory;
  subject?: string;
  description: string;
  priority?: ComplaintPriority;
  latitude?: number;
  longitude?: number;
  evidenceUrl?: string;
}) {
  const created = await prisma.complaint.create({
    data: {
      reference: `CMP-${Date.now()}-${randomUUID().slice(0, 8)}`,
      passengerId: input.passengerId,
      busId: input.busId,
      driverId: input.driverId,
      routeId: input.routeId,
      tripId: input.tripId,
      category: input.category,
      subject: input.subject?.trim() || input.category,
      description: input.description,
      priority: input.priority ?? "MEDIUM",
      latitude: input.latitude,
      longitude: input.longitude,
      evidenceUrl: input.evidenceUrl,
    },
    include: COMPLAINT_INCLUDE,
  });
  await notifyCreated(created);
  emitComplaint(created);
  return projectComplaint(created, "passenger");
}

export async function listComplaints(req: Request) {
  const roles = req.user!.roles;
  const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
  const companyId = await ownerCompanyId(req);
  const where: Prisma.ComplaintWhereInput = {
    ...(roles.includes("PASSENGER") ? { passengerId: req.user!.id } : {}),
    ...(isOwner(roles) ? scopeWhere(companyId) : {}),
  };
  const cities = await policeCityScope(req);
  if (cities) where.AND = [placeRecordFilter(cities)];

  if (typeof req.query.status === "string" && req.query.status) {
    if (!["PENDING", "UNDER_REVIEW", "RESOLVED", "REJECTED"].includes(req.query.status)) {
      throw new ApiError("Invalid complaint status", 422);
    }
    where.status = req.query.status as ComplaintStatus;
  }
  if (typeof req.query.priority === "string" && req.query.priority) {
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(req.query.priority)) {
      throw new ApiError("Invalid complaint priority", 422);
    }
    where.priority = req.query.priority as ComplaintPriority;
  }
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { bus: { registrationNo: { contains: q, mode: "insensitive" } } },
      { route: { code: { contains: q, mode: "insensitive" } } },
      { route: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: COMPLAINT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.complaint.count({ where }),
  ]);

  return {
    items: rows.map((row) => projectComplaint(row, roles.includes("PASSENGER") ? "passenger" : "monitor")),
    page,
    pageSize,
    total,
    dataLabel: "APPLICATION WORKFLOW — not a live complaint dispatch",
  };
}

export async function getComplaint(req: Request, id: string) {
  const row = await loadComplaint(id);
  const roles = req.user!.roles;
  const passenger = roles.includes("PASSENGER");
  const companyId = await ownerCompanyId(req);
  if (passenger && row.passengerId !== req.user!.id) {
    throw new ApiError("You cannot access another passenger's complaint", 403);
  }
  if (isOwner(roles) && companyId && row.bus?.companyId !== companyId && row.route?.companyId !== companyId) {
    throw new ApiError("You cannot access another operator's complaint", 403);
  }
  if (!passenger) {
    await assertPolicePlace(req, {
      busId: row.busId,
      routeId: row.routeId,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
    });
  }
  if (!passenger && !hasPermission(roles, "complaints.read")) {
    throw new ApiError("Insufficient permission", 403);
  }
  return projectComplaint(row, passenger ? "passenger" : "monitor");
}

export async function updateComplaintStatus(id: string, status: ComplaintStatus, actorId: string, req?: Request) {
  const existing = await loadComplaint(id);
  if (req) {
    await assertPolicePlace(req, {
      busId: existing.busId,
      routeId: existing.routeId,
      latitude: existing.latitude == null ? null : Number(existing.latitude),
      longitude: existing.longitude == null ? null : Number(existing.longitude),
    });
  }
  const allowed = activeTransitions(existing.status);
  if (!allowed.includes(status)) {
    throw new ApiError(`Cannot change complaint from ${existing.status} to ${status}`, 422);
  }
  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      status,
      resolvedById: status === "RESOLVED" || status === "REJECTED" ? actorId : existing.resolvedById,
      resolvedAt: status === "RESOLVED" || status === "REJECTED" ? new Date() : existing.resolvedAt,
    },
    include: COMPLAINT_INCLUDE,
  });
  await notifyUpdated(updated, existing.status);
  emitComplaint(updated);
  return projectComplaint(updated, "monitor");
}

export async function updateComplaintNote(id: string, internalNote: string, req?: Request) {
  const existing = await loadComplaint(id);
  if (req) {
    await assertPolicePlace(req, {
      busId: existing.busId,
      routeId: existing.routeId,
      latitude: existing.latitude == null ? null : Number(existing.latitude),
      longitude: existing.longitude == null ? null : Number(existing.longitude),
    });
  }
  const updated = await prisma.complaint.update({
    where: { id },
    data: { internalNote },
    include: COMPLAINT_INCLUDE,
  });
  emitComplaint(updated);
  return projectComplaint(updated, "monitor");
}

export async function assignComplaint(id: string, assignedToId: string, req?: Request) {
  const existing = await loadComplaint(id);
  if (req) {
    await assertPolicePlace(req, {
      busId: existing.busId,
      routeId: existing.routeId,
      latitude: existing.latitude == null ? null : Number(existing.latitude),
      longitude: existing.longitude == null ? null : Number(existing.longitude),
    });
  }
  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      assignedToId,
      status: existing.status === "PENDING" ? "UNDER_REVIEW" : existing.status,
    },
    include: COMPLAINT_INCLUDE,
  });
  emitComplaint(updated);
  return projectComplaint(updated, "monitor");
}
