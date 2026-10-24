import type { Prisma, RoleCode, UserStatus } from "@prisma/client";
import type { Request } from "express";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import {
  driverAssignmentBlockReason,
  isDriverEligibleForDuty,
} from "../utils/driverDto.js";
import { hasPermission } from "../utils/permissions.js";
import {
  assertCoordinate,
  assertPolyline,
  assertStops,
  projectRoute,
  routeCompanyCompatible,
  type RouteStopInput,
  type RouteWriteInput,
} from "../utils/routeDto.js";
import { policeCityScope, routePlaceWhere } from "../utils/policeArea.js";
import { ownerCompanyId, pagination } from "../utils/scope.js";

export const routeInclude = {
  company: { select: { id: true, name: true } },
  stops: { orderBy: { sequence: "asc" as const } },
  buses: { where: { deletedAt: null }, select: { id: true, registrationNo: true, operationalStatus: true, companyId: true } },
  _count: { select: { buses: { where: { deletedAt: null } } } },
} satisfies Prisma.RouteInclude;

function rolesOf(req: Request): RoleCode[] {
  return req.user?.roles ?? [];
}

function isOwnerOnly(req: Request) {
  const roles = rolesOf(req);
  return roles.includes("TRANSPORT_OWNER") && !roles.includes("SUPER_ADMIN");
}

function canManageRoutes(req: Request) {
  return hasPermission(rolesOf(req), "routes.manage");
}

export async function assertCanManageRoute(req: Request, route: { companyId: string | null }) {
  if (!canManageRoutes(req)) throw new ApiError("Insufficient permission", 403);
  if (!isOwnerOnly(req)) return;
  const companyId = await ownerCompanyId(req);
  if (route.companyId !== companyId) {
    throw new ApiError("You cannot modify another operator's route", 403);
  }
}

export async function getManageableRoute(req: Request, id: string) {
  const route = await prisma.route.findFirst({
    where: { id, deletedAt: null },
    include: routeInclude,
  });
  if (!route) throw new ApiError("Route not found", 404);
  return route;
}

async function closeOpenAssignment(busId: string) {
  await prisma.busAssignment.updateMany({
    where: { busId, endedAt: null },
    data: { endedAt: new Date() },
  });
}

export async function listRoutes(req: Request) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const paginated = req.query.page !== undefined || req.query.pageSize !== undefined;
  const ownerCid = req.user ? await ownerCompanyId(req).catch(() => undefined) : undefined;
  const ownerScoped = Boolean(ownerCid) && isOwnerOnly(req);

  const where: Prisma.RouteWhereInput = { deletedAt: null };
  if (status && canManageRoutes(req)) {
    where.status = status as UserStatus;
  } else if (!canManageRoutes(req) || !paginated) {
    where.status = "ACTIVE";
  }
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { startName: { contains: q, mode: "insensitive" } },
      { endName: { contains: q, mode: "insensitive" } },
      { stops: { some: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (ownerScoped && paginated) {
    where.companyId = ownerCid;
  }
  const cities = req.user ? await policeCityScope(req) : null;
  if (cities) where.AND = [routePlaceWhere(cities)];

  const include = {
    company: { select: { id: true, name: true } },
    stops: { orderBy: { sequence: "asc" as const } },
    _count: { select: { buses: { where: { deletedAt: null } } } },
  };

  if (!paginated) {
    const items = await prisma.route.findMany({
      where,
      include,
      orderBy: { name: "asc" },
    });
    return items.map((row) => projectRoute(row));
  }

  const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
  const [rows, total] = await Promise.all([
    prisma.route.findMany({
      where,
      include,
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    prisma.route.count({ where }),
  ]);
  return {
    items: rows.map((row) => projectRoute(row)),
    page,
    pageSize,
    total,
  };
}

export async function getRoute(req: Request, id: string) {
  const route = await prisma.route.findFirst({
    where: { id, deletedAt: null },
    include: routeInclude,
  });
  if (!route) throw new ApiError("Route not found", 404);
  return projectRoute(route);
}

function normalizeWrite(body: RouteWriteInput) {
  const polyline = assertPolyline(body.polyline);
  assertCoordinate(body.startLat, body.startLng, "Origin");
  assertCoordinate(body.endLat, body.endLng, "Destination");
  const stops = body.stops ? assertStops(body.stops) : undefined;
  return {
    code: body.code.trim().toUpperCase(),
    name: body.name.trim(),
    startName: body.startName.trim(),
    endName: body.endName.trim(),
    startLat: body.startLat,
    startLng: body.startLng,
    endLat: body.endLat,
    endLng: body.endLng,
    city: body.city.trim(),
    allowedSpeed: body.allowedSpeed ?? 40,
    polyline,
    stops,
  };
}

export async function createRoute(req: Request, body: RouteWriteInput) {
  if (!canManageRoutes(req)) throw new ApiError("Insufficient permission", 403);
  const ownerCid = await ownerCompanyId(req).catch(() => undefined);
  const companyId = isOwnerOnly(req) ? ownerCid : (body.companyId ?? ownerCid ?? null);
  if (isOwnerOnly(req) && !companyId) throw new ApiError("No transport company is linked to this owner account", 403);
  if (companyId) {
    const company = await prisma.transportCompany.findFirst({ where: { id: companyId, deletedAt: null } });
    if (!company) throw new ApiError("Operator / company not found", 400);
  }

  const data = normalizeWrite(body);
  const existing = await prisma.route.findFirst({ where: { code: data.code, deletedAt: null } });
  if (existing) throw new ApiError("Route code already exists", 409);

  const created = await prisma.route.create({
    data: {
      ...data,
      companyId,
      isDemo: !companyId,
      status: "ACTIVE",
      stops: data.stops ? { create: data.stops } : undefined,
    },
    include: routeInclude,
  });
  return projectRoute(created);
}

export async function updateRoute(req: Request, id: string, body: Partial<RouteWriteInput>) {
  const existing = await getManageableRoute(req, id);
  await assertCanManageRoute(req, existing);

  const data: Prisma.RouteUpdateInput = {};
  if (typeof body.code === "string") {
    const code = body.code.trim().toUpperCase();
    const clash = await prisma.route.findFirst({ where: { code, deletedAt: null, NOT: { id } } });
    if (clash) throw new ApiError("Route code already exists", 409);
    data.code = code;
  }
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.startName === "string") data.startName = body.startName.trim();
  if (typeof body.endName === "string") data.endName = body.endName.trim();
  if (typeof body.city === "string") data.city = body.city.trim();
  if (typeof body.allowedSpeed === "number") data.allowedSpeed = body.allowedSpeed;
  if (body.startLat != null && body.startLng != null) {
    assertCoordinate(body.startLat, body.startLng, "Origin");
    data.startLat = body.startLat;
    data.startLng = body.startLng;
  }
  if (body.endLat != null && body.endLng != null) {
    assertCoordinate(body.endLat, body.endLng, "Destination");
    data.endLat = body.endLat;
    data.endLng = body.endLng;
  }
  if (body.polyline) data.polyline = assertPolyline(body.polyline);

  if (!isOwnerOnly(req) && body.companyId !== undefined) {
    if (body.companyId) {
      const company = await prisma.transportCompany.findFirst({ where: { id: body.companyId, deletedAt: null } });
      if (!company) throw new ApiError("Operator / company not found", 400);
      data.company = { connect: { id: body.companyId } };
    } else {
      data.company = { disconnect: true };
    }
  }

  if (Array.isArray(body.stops)) {
    const stops = assertStops(body.stops);
    await prisma.routeStop.deleteMany({ where: { routeId: id } });
    data.stops = { create: stops };
  }

  const updated = await prisma.route.update({
    where: { id },
    data,
    include: routeInclude,
  });
  return projectRoute(updated);
}

export async function changeRouteStatus(req: Request, id: string, status: UserStatus) {
  const existing = await getManageableRoute(req, id);
  await assertCanManageRoute(req, existing);
  const updated = await prisma.route.update({
    where: { id },
    data: { status },
    include: routeInclude,
  });
  return projectRoute(updated);
}

export async function archiveRoute(req: Request, id: string) {
  const existing = await getManageableRoute(req, id);
  await assertCanManageRoute(req, existing);
  await prisma.route.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
}

export async function replaceStops(req: Request, id: string, stops: RouteStopInput[]) {
  const existing = await getManageableRoute(req, id);
  await assertCanManageRoute(req, existing);
  const ordered = assertStops(stops);
  await prisma.$transaction([
    prisma.routeStop.deleteMany({ where: { routeId: id } }),
    prisma.routeStop.createMany({
      data: ordered.map((stop) => ({ ...stop, routeId: id })),
    }),
  ]);
  return getRoute(req, id);
}

export async function addStop(req: Request, id: string, stop: RouteStopInput) {
  const existing = await getManageableRoute(req, id);
  await assertCanManageRoute(req, existing);
  assertStops([
    ...existing.stops.map((s) => ({
      name: s.name,
      sequence: s.sequence,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      dwellSeconds: s.dwellSeconds,
    })),
    stop,
  ]);
  await prisma.routeStop.create({
    data: {
      routeId: id,
      name: stop.name.trim(),
      sequence: stop.sequence,
      latitude: stop.latitude,
      longitude: stop.longitude,
      dwellSeconds: stop.dwellSeconds ?? 30,
    },
  });
  return getRoute(req, id);
}

export async function updateStop(req: Request, routeId: string, stopId: string, patch: Partial<RouteStopInput>) {
  const existing = await getManageableRoute(req, routeId);
  await assertCanManageRoute(req, existing);
  const current = existing.stops.find((s) => s.id === stopId);
  if (!current) throw new ApiError("Stop not found", 404);
  const next: RouteStopInput = {
    name: patch.name ?? current.name,
    sequence: patch.sequence ?? current.sequence,
    latitude: patch.latitude ?? Number(current.latitude),
    longitude: patch.longitude ?? Number(current.longitude),
    dwellSeconds: patch.dwellSeconds ?? current.dwellSeconds,
  };
  const others = existing.stops
    .filter((s) => s.id !== stopId)
    .map((s) => ({
      name: s.name,
      sequence: s.sequence,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      dwellSeconds: s.dwellSeconds,
    }));
  assertStops([...others, next]);
  await prisma.routeStop.update({
    where: { id: stopId },
    data: next,
  });
  return getRoute(req, routeId);
}

export async function removeStop(req: Request, routeId: string, stopId: string) {
  const existing = await getManageableRoute(req, routeId);
  await assertCanManageRoute(req, existing);
  const current = existing.stops.find((s) => s.id === stopId);
  if (!current) throw new ApiError("Stop not found", 404);
  await prisma.routeStop.delete({ where: { id: stopId } });
  return getRoute(req, routeId);
}

async function assertAssignablePair(
  bus: {
    id?: string;
    companyId: string;
    operationalStatus: string;
    registrationStatus: string;
    deletedAt: Date | null;
    driverId: string | null;
  },
  route: { id: string; companyId: string | null; isDemo: boolean; status: UserStatus; deletedAt: Date | null },
  opts?: { allowInactive?: boolean },
) {
  if (bus.deletedAt) throw new ApiError("Cannot assign an archived vehicle", 409);
  if (route.deletedAt) throw new ApiError("Route not found", 404);
  if (route.status !== "ACTIVE") throw new ApiError("Cannot assign a vehicle to an inactive route", 409);
  if (bus.registrationStatus === "SUSPENDED") throw new ApiError("Cannot assign a suspended vehicle", 409);
  if (bus.operationalStatus === "OFFLINE") throw new ApiError("Cannot assign an offline vehicle", 409);
  if (!opts?.allowInactive && bus.operationalStatus === "INACTIVE") {
    throw new ApiError("Cannot assign an inactive vehicle", 409);
  }
  if (!routeCompanyCompatible(route, bus.companyId)) {
    throw new ApiError("Vehicle operator is not authorized for this route", 403);
  }
  if (bus.driverId) {
    const driver = await prisma.driver.findFirst({ where: { id: bus.driverId, deletedAt: null } });
    if (driver && !isDriverEligibleForDuty(driver)) {
      throw new ApiError(driverAssignmentBlockReason(driver), 409);
    }
  }
}

export async function assertRouteForBusCreate(routeId: string, companyId: string) {
  const route = await prisma.route.findFirst({ where: { id: routeId, deletedAt: null } });
  if (!route) throw new ApiError("Route not found", 400);
  if (route.status !== "ACTIVE") throw new ApiError("Cannot assign a vehicle to an inactive route", 409);
  if (!routeCompanyCompatible(route, companyId)) {
    throw new ApiError("Vehicle operator is not authorized for this route", 403);
  }
}

export async function assertRouteForBusUpdate(
  routeId: string,
  bus: {
    companyId: string;
    operationalStatus: string;
    registrationStatus: string;
    deletedAt: Date | null;
    driverId: string | null;
  },
) {
  const route = await prisma.route.findFirst({ where: { id: routeId, deletedAt: null } });
  if (!route) throw new ApiError("Route not found", 400);
  await assertAssignablePair(bus, route, { allowInactive: bus.operationalStatus === "INACTIVE" });
}

export async function assignBusToRoute(req: Request, routeId: string, busId: string) {
  const route = await getManageableRoute(req, routeId);
  await assertCanManageRoute(req, route);
  const bus = await prisma.bus.findFirst({ where: { id: busId, deletedAt: null } });
  if (!bus) throw new ApiError("Vehicle not found", 404);
  const ownerCid = await ownerCompanyId(req).catch(() => undefined);
  if (ownerCid && bus.companyId !== ownerCid) {
    throw new ApiError("You cannot assign another operator's vehicle", 403);
  }
  await assertAssignablePair(bus, route);
  await closeOpenAssignment(bus.id);
  await prisma.bus.update({ where: { id: bus.id }, data: { routeId: route.id } });
  await prisma.busAssignment.create({ data: { busId: bus.id, routeId: route.id } });
  return getRoute(req, route.id);
}

export async function unassignBusFromRoute(req: Request, routeId: string, busId: string) {
  const route = await getManageableRoute(req, routeId);
  await assertCanManageRoute(req, route);
  const bus = await prisma.bus.findFirst({ where: { id: busId, deletedAt: null } });
  if (!bus) throw new ApiError("Vehicle not found", 404);
  const ownerCid = await ownerCompanyId(req).catch(() => undefined);
  if (ownerCid && bus.companyId !== ownerCid) {
    throw new ApiError("You cannot unassign another operator's vehicle", 403);
  }
  if (bus.routeId !== route.id) throw new ApiError("Vehicle is not assigned to this route", 409);
  await closeOpenAssignment(bus.id);
  await prisma.bus.update({ where: { id: bus.id }, data: { routeId: null } });
  return getRoute(req, route.id);
}
