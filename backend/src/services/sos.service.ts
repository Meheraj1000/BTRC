import { AlertStatus, SosLocationSource, SosStatus, type Prisma, type RoleCode } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";
import { broadcastAlert, broadcastSos, emitToUser } from "../lib/socket.js";
import { notifyRoles, notifyUser } from "./notification.service.js";
import { hasPermission } from "../utils/permissions.js";
import { assertPolicePlace, cityForPoint, placeRecordFilter, policeCityScope } from "../utils/policeArea.js";
import { pagination } from "../utils/scope.js";

export const ACTIVE_SOS_STATUSES: SosStatus[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "DISPATCHED",
  "INVESTIGATING",
  "RESPONDING",
];

const MONITOR_TRANSITIONS: Record<SosStatus, SosStatus[]> = {
  OPEN: ["ACKNOWLEDGED", "FALSE_ALARM"],
  ACKNOWLEDGED: ["INVESTIGATING", "DISPATCHED", "RESPONDING", "RESOLVED", "FALSE_ALARM"],
  INVESTIGATING: ["RESPONDING", "DISPATCHED", "RESOLVED", "FALSE_ALARM"],
  DISPATCHED: ["RESPONDING", "RESOLVED"],
  RESPONDING: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  FALSE_ALARM: ["CLOSED"],
  CANCELLED: ["CLOSED"],
  CLOSED: [],
};

const SOS_INCLUDE = {
  user: { select: { id: true, fullName: true } },
  bus: { select: { id: true, registrationNo: true, routeId: true, driverId: true, latestLoc: true, route: { select: { id: true, code: true, name: true, city: true } } } },
  trip: { select: { id: true, routeId: true } },
  route: { select: { id: true, code: true, name: true, city: true } },
  driver: { select: { id: true, user: { select: { fullName: true } } } },
} satisfies Prisma.SosRequestInclude;

type SosRow = Prisma.SosRequestGetPayload<{ include: typeof SOS_INCLUDE }>;

function isMonitor(roles: RoleCode[]) {
  return hasPermission(roles, "sos.read");
}

function parseCoord(value: unknown, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (Math.abs(value) > max) return null;
  return value;
}

function locationAvailable(lat: number | null, lng: number | null) {
  return lat != null && lng != null;
}

function projectVehicle(row: SosRow) {
  const latest = row.bus?.latestLoc;
  if (!latest) return null;
  const ageMs = Date.now() - latest.timestamp.getTime();
  return {
    latitude: Number(latest.latitude),
    longitude: Number(latest.longitude),
    timestamp: latest.timestamp,
    stale: ageMs > 5 * 60 * 1000,
    source: latest.source,
  };
}

function projectSos(row: SosRow, view: "passenger" | "monitor") {
  const latitude = row.latitude == null ? null : Number(row.latitude);
  const longitude = row.longitude == null ? null : Number(row.longitude);
  const available = locationAvailable(latitude, longitude);
  const base = {
    id: row.id,
    status: row.status,
    severity: "CRITICAL" as const,
    category: row.category ?? "OTHER",
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    cancelledAt: row.cancelledAt,
    locationAvailable: available,
    locationSource: row.locationSource,
    locationAt: row.locationAt,
    latitude: available ? latitude : null,
    longitude: available ? longitude : null,
    registrationNo: row.bus?.registrationNo ?? null,
    routeCode: row.route?.code ?? row.bus?.route?.code ?? null,
    routeName: row.route?.name ?? row.bus?.route?.name ?? null,
    dataLabel: "APPLICATION WORKFLOW — not a live emergency dispatch",
    existing: undefined as boolean | undefined,
  };
  if (view === "passenger") {
    return {
      ...base,
      requesterName: null,
      driverName: null,
      internalNote: null,
      vehicleLocation: null,
      busId: row.busId,
      tripId: row.tripId,
    };
  }
  return {
    ...base,
    requesterName: row.user.fullName,
    roleHint: row.roleHint,
    driverName: row.driver?.user.fullName ?? null,
    internalNote: row.internalNote,
    vehicleLocation: projectVehicle(row),
    busId: row.busId,
    tripId: row.tripId,
    routeId: row.routeId ?? row.bus?.routeId ?? null,
    alertId: row.alertId,
  };
}

async function loadSos(id: string) {
  const row = await prisma.sosRequest.findUnique({ where: { id }, include: SOS_INCLUDE });
  if (!row) throw new ApiError("SOS request not found", 404);
  return row;
}

async function resolveAssociations(input: {
  userId: string;
  roles: RoleCode[];
  busId?: string;
  tripId?: string;
}) {
  let busId = input.busId;
  let tripId = input.tripId;
  let routeId: string | undefined;
  let driverId: string | undefined;

  if (input.roles.includes("DRIVER")) {
    const driver = await prisma.driver.findUnique({
      where: { userId: input.userId },
      select: { id: true },
    });
    driverId = driver?.id;
    if (driverId && !busId) {
      const assigned = await prisma.bus.findFirst({
        where: { driverId, deletedAt: null },
        select: { id: true, routeId: true },
      });
      if (assigned) {
        busId = assigned.id;
        routeId = assigned.routeId ?? undefined;
      }
    }
    if (driverId && !tripId) {
      const trip = await prisma.trip.findFirst({
        where: { driverId, status: "IN_PROGRESS" },
        orderBy: { startedAt: "desc" },
        select: { id: true, busId: true, routeId: true },
      });
      if (trip) {
        tripId = trip.id;
        busId = busId ?? trip.busId;
        routeId = routeId ?? trip.routeId;
      }
    }
  }

  if (busId) {
    const bus = await prisma.bus.findFirst({
      where: { id: busId, deletedAt: null },
      select: { id: true, routeId: true, driverId: true },
    });
    if (!bus) {
      busId = undefined;
    } else {
      routeId = routeId ?? bus.routeId ?? undefined;
      driverId = driverId ?? bus.driverId ?? undefined;
    }
  }

  if (tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, busId: true, routeId: true, driverId: true },
    });
    if (!trip) tripId = undefined;
    else {
      busId = busId ?? trip.busId;
      routeId = routeId ?? trip.routeId;
      driverId = driverId ?? trip.driverId;
    }
  }

  return { busId, tripId, routeId, driverId };
}

async function notifyCreated(row: SosRow) {
  const payload = {
    sosId: row.id,
    status: row.status,
    busId: row.busId ?? row.bus?.id ?? null,
    registrationNo: row.bus?.registrationNo ?? null,
    driverId: row.driverId ?? row.driver?.id ?? null,
    routeId: row.routeId ?? row.route?.id ?? row.bus?.routeId ?? null,
    source: "SOS",
  };
  await notifyUser({
    userId: row.userId,
    type: "SOS",
    title: "SOS recorded",
    body: "Your SOS was stored in this application for authorized monitoring. This is not a live police, ambulance, or 999 dispatch.",
    payload,
  });
  await notifyRoles(["SUPER_ADMIN", "GOVERNMENT", "POLICE"], {
    type: "SOS",
    title: "New SOS",
    body: row.bus?.registrationNo
      ? `SOS linked to ${row.bus.registrationNo}. Open the notice for bus, driver, and live location.`
      : "A passenger or driver recorded an SOS. Open the notice for details when a vehicle is linked.",
    payload: {
      ...payload,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
    },
  });
}

async function notifyStatus(row: SosRow, previous: SosStatus) {
  await notifyUser({
    userId: row.userId,
    type: "SOS",
    title: `SOS ${row.status.toLowerCase()}`,
    body: `Your SOS status changed from ${previous} to ${row.status}. This is an in-app update only.`,
    payload: { sosId: row.id, status: row.status },
  });
}

function sosCity(row: SosRow) {
  return row.route?.city
    ?? row.bus?.route?.city
    ?? cityForPoint(row.latitude == null ? null : Number(row.latitude), row.longitude == null ? null : Number(row.longitude));
}

function emitRealtime(row: SosRow) {
  try {
    broadcastSos(projectSos(row, "monitor"), sosCity(row));
    emitToUser(row.userId, "sos:update", projectSos(row, "passenger"));
  } catch {
    // sockets may be unavailable in tests
  }
}

async function syncLinkedAlert(alertId: string | null | undefined, status: SosStatus) {
  if (!alertId) return;
  const alertStatus: AlertStatus =
    status === "OPEN" ? "OPEN"
      : status === "RESOLVED" || status === "FALSE_ALARM" || status === "CANCELLED" || status === "CLOSED"
        ? "RESOLVED"
        : "ACKNOWLEDGED";
  await prisma.alert.updateMany({
    where: { id: alertId },
    data: {
      status: alertStatus,
      resolvedAt: alertStatus === "RESOLVED" ? new Date() : undefined,
    },
  });
}

export async function createSos(input: {
  userId: string;
  roles: RoleCode[];
  busId?: string;
  tripId?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
  category?: string;
  idempotencyKey?: string;
}) {
  if (input.idempotencyKey) {
    const replay = await prisma.sosRequest.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: SOS_INCLUDE,
    });
    if (replay) {
      if (!ACTIVE_SOS_STATUSES.includes(replay.status)) {
        // Terminal SOS kept the key only briefly; allow a fresh create with a new key path.
        // If a terminal row still holds the key, clear and continue.
        await prisma.sosRequest.update({
          where: { id: replay.id },
          data: { idempotencyKey: null },
        });
      } else {
        const view = isMonitor(input.roles) ? "monitor" : "passenger";
        return { ...projectSos(replay, view), existing: true };
      }
    }
  }

  const active = await prisma.sosRequest.findFirst({
    where: { userId: input.userId, status: { in: ACTIVE_SOS_STATUSES } },
    include: SOS_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  if (active) {
    const view = isMonitor(input.roles) ? "monitor" : "passenger";
    return { ...projectSos(active, view), existing: true };
  }

  const lat = parseCoord(input.latitude, 90);
  const lng = parseCoord(input.longitude, 180);
  const available = locationAvailable(lat, lng);
  const assoc = await resolveAssociations(input);
  const category = ["SAFETY", "MEDICAL", "ACCIDENT", "OTHER"].includes(input.category ?? "")
    ? input.category
    : "OTHER";

  const created = await prisma.sosRequest.create({
    data: {
      userId: input.userId,
      roleHint: input.roles[0] ?? "PASSENGER",
      busId: assoc.busId,
      tripId: assoc.tripId,
      routeId: assoc.routeId,
      driverId: assoc.driverId,
      latitude: available ? lat : null,
      longitude: available ? lng : null,
      locationSource: available ? SosLocationSource.DEVICE : SosLocationSource.UNAVAILABLE,
      locationAt: available ? new Date() : null,
      message: input.message,
      category,
      idempotencyKey: input.idempotencyKey,
    },
    include: SOS_INCLUDE,
  });

  const alert = await prisma.alert.create({
    data: {
      type: "SOS",
      severity: "CRITICAL",
      busId: assoc.busId,
      driverId: assoc.driverId,
      tripId: assoc.tripId,
      routeId: assoc.routeId,
      latitude: available ? lat : null,
      longitude: available ? lng : null,
      message: `SOS from ${created.user.fullName}: ${input.message ?? "Emergency assistance requested"}`,
      dataSource: "SIMULATED",
    },
  });

  const row = await prisma.sosRequest.update({
    where: { id: created.id },
    data: { alertId: alert.id },
    include: SOS_INCLUDE,
  });

  await notifyCreated(row);
  emitRealtime(row);
  try {
    broadcastAlert({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      registrationNo: row.bus?.registrationNo ?? null,
      driverName: row.driver?.user.fullName ?? null,
      routeCode: row.route?.code ?? row.bus?.route?.code ?? null,
      createdAt: alert.createdAt,
      latitude: available ? lat : null,
      longitude: available ? lng : null,
      sosId: row.id,
      dataLabel: "APPLICATION WORKFLOW — not a live emergency dispatch",
    }, undefined, sosCity(row));
  } catch {
    // sockets may be unavailable in tests
  }
  return { ...projectSos(row, isMonitor(input.roles) ? "monitor" : "passenger"), existing: false };
}

export async function listSos(req: Request) {
  const roles = req.user!.roles;
  const monitor = isMonitor(roles);
  if (!monitor && !hasPermission(roles, "sos.create")) {
    throw new ApiError("Insufficient permission", 403);
  }

  const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
  const where: Prisma.SosRequestWhereInput = {};
  if (!monitor) where.userId = req.user!.id;
  const cities = await policeCityScope(req);
  if (cities) where.AND = [placeRecordFilter(cities)];

  if (typeof req.query.status === "string" && req.query.status) {
    if (!Object.values(SosStatus).includes(req.query.status as SosStatus)) {
      throw new ApiError("Invalid SOS status", 422);
    }
    where.status = req.query.status as SosStatus;
  }
  if (typeof req.query.from === "string" && req.query.from) {
    const from = new Date(req.query.from);
    if (Number.isNaN(from.getTime())) throw new ApiError("Invalid from date", 422);
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter | undefined), gte: from };
  }
  if (typeof req.query.to === "string" && req.query.to) {
    const to = new Date(req.query.to);
    if (Number.isNaN(to.getTime())) throw new ApiError("Invalid to date", 422);
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter | undefined), lte: to };
  }
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    const userSearch = monitor
      ? [{ user: { fullName: { contains: q, mode: "insensitive" as const } } }]
      : [];
    where.OR = [
      { message: { contains: q, mode: "insensitive" as const } },
      { bus: { registrationNo: { contains: q, mode: "insensitive" as const } } },
      ...userSearch,
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.sosRequest.findMany({
      where,
      include: SOS_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.sosRequest.count({ where }),
  ]);

  return {
    items: rows.map((row) => projectSos(row, monitor ? "monitor" : "passenger")),
    page,
    pageSize,
    total,
    dataLabel: "APPLICATION WORKFLOW — not a live emergency dispatch",
  };
}

export async function getSos(req: Request, id: string) {
  const row = await loadSos(id);
  const roles = req.user!.roles;
  const monitor = isMonitor(roles);
  if (!monitor && row.userId !== req.user!.id) {
    throw new ApiError("You cannot access another user's SOS", 403);
  }
  if (monitor) {
    await assertPolicePlace(req, {
      busId: row.busId,
      routeId: row.routeId,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
    });
  }
  if (!monitor && !hasPermission(roles, "sos.create")) {
    throw new ApiError("Insufficient permission", 403);
  }
  return projectSos(row, monitor ? "monitor" : "passenger");
}

export async function updateSosStatus(id: string, status: SosStatus, actorId: string, req?: Request) {
  const existing = await loadSos(id);
  if (req) {
    await assertPolicePlace(req, {
      busId: existing.busId,
      routeId: existing.routeId,
      latitude: existing.latitude == null ? null : Number(existing.latitude),
      longitude: existing.longitude == null ? null : Number(existing.longitude),
    });
  }
  const allowed = MONITOR_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(status)) {
    throw new ApiError(`Cannot change SOS from ${existing.status} to ${status}`, 422);
  }
  const resolved = status === "RESOLVED" || status === "FALSE_ALARM" || status === "CLOSED";
  const row = await prisma.sosRequest.update({
    where: { id },
    data: {
      status,
      resolvedAt: resolved ? existing.resolvedAt ?? new Date() : existing.resolvedAt,
      ...(resolved || (status as unknown as string) === "FALSE_ALARM" ? { idempotencyKey: null } : {}),
    },
    include: SOS_INCLUDE,
  });
  await syncLinkedAlert(row.alertId, status);
  await notifyStatus(row, existing.status);
  emitRealtime(row);
  void actorId;
  return projectSos(row, "monitor");
}

export async function cancelSos(req: Request, id: string) {
  const row = await loadSos(id);
  if (row.userId !== req.user!.id) {
    throw new ApiError("You can only cancel your own SOS", 403);
  }
  if (row.status !== "OPEN") {
    throw new ApiError("Only an OPEN SOS can be cancelled by the requester", 422);
  }
  const updated = await prisma.sosRequest.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: req.user!.id,
      resolvedAt: new Date(),
      idempotencyKey: null,
    },
    include: SOS_INCLUDE,
  });
  await syncLinkedAlert(updated.alertId, "CANCELLED");
  await notifyStatus(updated, row.status);
  emitRealtime(updated);
  return projectSos(updated, isMonitor(req.user!.roles) ? "monitor" : "passenger");
}

export async function updateSosNote(id: string, internalNote: string, req?: Request) {
  const existing = await loadSos(id);
  if (req) {
    await assertPolicePlace(req, {
      busId: existing.busId,
      routeId: existing.routeId,
      latitude: existing.latitude == null ? null : Number(existing.latitude),
      longitude: existing.longitude == null ? null : Number(existing.longitude),
    });
  }
  const row = await prisma.sosRequest.update({
    where: { id },
    data: { internalNote },
    include: SOS_INCLUDE,
  });
  void existing;
  return projectSos(row, "monitor");
}
