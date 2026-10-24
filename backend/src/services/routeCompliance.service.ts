import { AlertSeverity, AlertType, type RouteComplianceStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";
import { broadcastAlert, broadcastRouteStatus } from "../lib/socket.js";
import { distanceToPolylineMeters, parsePolyline } from "../utils/geo.js";
import { deviationAgainstRoad } from "../utils/roadRoute.js";
import { trackingState } from "../utils/gpsQuality.js";
import { classifyDistance, complianceTransitioned, nextComplianceState } from "../utils/routeCompliance.js";
import { projectComplianceState } from "../utils/routeDto.js";
import { busPlaceWhere, policeCityScope, routePlaceWhere } from "../utils/policeArea.js";
import { ownerCompanyId, pagination } from "../utils/scope.js";
import type { Request } from "express";
import { notifyCompanyOwner, notifyRoles, notifyUser } from "./notification.service.js";

const complianceAlertCooldown = new Map<string, number>();

function shouldAlert(busId: string, cooldownMs = 120000) {
  const last = complianceAlertCooldown.get(busId) ?? 0;
  if (Date.now() - last < cooldownMs) return false;
  complianceAlertCooldown.set(busId, Date.now());
  return true;
}

export function complianceThresholds() {
  return {
    nearMeters: env.ROUTE_NEAR_THRESHOLD_METERS,
    offMeters: env.ROUTE_DEVIATION_THRESHOLD_METERS,
    consecutiveOff: env.ROUTE_DEVIATION_CONSECUTIVE,
    consecutiveOn: env.ROUTE_RETURN_CONSECUTIVE,
  };
}

export async function evaluateAndPersistCompliance(input: {
  busId: string;
  registrationNo: string;
  companyId: string;
  routeId?: string | null;
  polyline?: unknown;
  routeCode?: string;
  routeName?: string;
  city?: string | null;
  latitude: number;
  longitude: number;
  timestamp: Date;
  previousTimestamp?: Date | null;
  driverId?: string | null;
  tripId?: string | null;
}) {
  const thresholds = complianceThresholds();
  const previous = await prisma.routeComplianceState.findUnique({ where: { busId: input.busId } });
  let fromStatus: RouteComplianceStatus = previous?.status ?? "UNASSIGNED";
  let consecutiveOff = previous?.consecutiveOff ?? 0;
  let consecutiveOn = previous?.consecutiveOn ?? 0;

  if (input.previousTimestamp && trackingState(input.previousTimestamp, input.timestamp.getTime()) === "STALE" && fromStatus !== "STALE") {
    await persistTransition({
      busId: input.busId,
      routeId: input.routeId ?? null,
      fromStatus,
      toStatus: "STALE",
      deviationM: previous?.deviationM == null ? null : Number(previous.deviationM),
      latitude: input.latitude,
      longitude: input.longitude,
    });
    fromStatus = "STALE";
    consecutiveOff = 0;
    consecutiveOn = 0;
  }

  if (!input.routeId || !input.polyline) {
    const next = { status: "UNASSIGNED" as const, consecutiveOff: 0, consecutiveOn: 0 };
    const deviationM = null;
    await upsertState(input.busId, null, next, deviationM);
    if (complianceTransitioned(fromStatus, next.status)) {
      await persistTransition({
        busId: input.busId,
        routeId: null,
        fromStatus,
        toStatus: next.status,
        deviationM,
        latitude: input.latitude,
        longitude: input.longitude,
      });
    }
    broadcastRouteStatus({
      busId: input.busId,
      registrationNo: input.registrationNo,
      companyId: input.companyId,
      city: input.city ?? null,
      routeId: null,
      routeCode: null,
      routeName: null,
      status: next.status,
      deviationM,
      timestamp: input.timestamp,
    });
    return { status: next.status, deviationM, consecutiveOff: 0, consecutiveOn: 0 };
  }

  const line = parsePolyline(input.polyline);
  const point = { lat: input.latitude, lng: input.longitude };
  const chordM = line.length ? distanceToPolylineMeters(point, line) : Number.POSITIVE_INFINITY;
  const deviationM = await deviationAgainstRoad(point, line, chordM, thresholds.offMeters);
  const sample = classifyDistance(deviationM, thresholds);
  const next = nextComplianceState(
    { status: fromStatus, consecutiveOff, consecutiveOn },
    sample,
    thresholds,
  );

  await upsertState(input.busId, input.routeId, next, deviationM);

  if (complianceTransitioned(fromStatus, next.status)) {
    await persistTransition({
      busId: input.busId,
      routeId: input.routeId,
      fromStatus,
      toStatus: next.status,
      deviationM,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    if (next.status === "OFF_ROUTE" && shouldAlert(input.busId)) {
      await raiseDeviationAlert(input, deviationM);
    }
  }

  broadcastRouteStatus({
    busId: input.busId,
    registrationNo: input.registrationNo,
    companyId: input.companyId,
    city: input.city ?? null,
    routeId: input.routeId,
    routeCode: input.routeCode ?? null,
    routeName: input.routeName ?? null,
    status: next.status,
    deviationM,
    timestamp: input.timestamp,
  });

  return { status: next.status, deviationM, consecutiveOff: next.consecutiveOff, consecutiveOn: next.consecutiveOn };
}

async function upsertState(
  busId: string,
  routeId: string | null,
  next: { status: RouteComplianceStatus; consecutiveOff: number; consecutiveOn: number },
  deviationM: number | null,
) {
  await prisma.routeComplianceState.upsert({
    where: { busId },
    create: {
      busId,
      routeId,
      status: next.status,
      deviationM,
      consecutiveOff: next.consecutiveOff,
      consecutiveOn: next.consecutiveOn,
    },
    update: {
      routeId,
      status: next.status,
      deviationM,
      consecutiveOff: next.consecutiveOff,
      consecutiveOn: next.consecutiveOn,
    },
  });
}

async function persistTransition(data: {
  busId: string;
  routeId: string | null;
  fromStatus: RouteComplianceStatus;
  toStatus: RouteComplianceStatus;
  deviationM: number | null;
  latitude: number;
  longitude: number;
}) {
  await prisma.routeComplianceEvent.create({
    data: {
      busId: data.busId,
      routeId: data.routeId ?? undefined,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      deviationM: data.deviationM,
      latitude: data.latitude,
      longitude: data.longitude,
    },
  });
}

async function raiseDeviationAlert(
  input: {
    busId: string;
    registrationNo: string;
    companyId?: string;
    driverId?: string | null;
    tripId?: string | null;
    routeId?: string | null;
    latitude: number;
    longitude: number;
    city?: string | null;
  },
  deviationM: number,
) {
  const alert = await prisma.alert.create({
    data: {
      type: AlertType.ROUTE_DEVIATION,
      severity: deviationM > 600 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      busId: input.busId,
      driverId: input.driverId ?? undefined,
      tripId: input.tripId ?? undefined,
      routeId: input.routeId ?? undefined,
      latitude: input.latitude,
      longitude: input.longitude,
      deviationM,
      message: `Route deviation ${Math.round(deviationM)} m for ${input.registrationNo}`,
      dataSource: env.GPS_SOURCE_MODE === "DEVICE" ? "REAL" : "SIMULATED",
    },
  });
  if (input.driverId) {
    await prisma.violation.create({
      data: {
        busId: input.busId,
        driverId: input.driverId,
        type: AlertType.ROUTE_DEVIATION,
        description: alert.message,
        latitude: input.latitude,
        longitude: input.longitude,
        dataSource: env.GPS_SOURCE_MODE === "DEVICE" ? "REAL" : "SIMULATED",
      },
    });
    await prisma.driver.update({
      where: { id: input.driverId },
      data: { violationCount: { increment: 1 }, performanceScore: { decrement: 1.5 } },
    }).catch(() => undefined);
  }
  try {
    broadcastAlert(alert, input.companyId, input.city ?? null);
  } catch {
    // tests without socket
  }
  await notifyRoles(["SUPER_ADMIN", "GOVERNMENT", "POLICE", "BRTA"], {
    type: "ROUTE_DEVIATION",
    title: "Route deviation alert",
    body: alert.message,
    payload: { alertId: alert.id, busId: input.busId },
  });
  await notifyCompanyOwner(input.companyId, {
    type: "ROUTE_DEVIATION",
    title: "Route deviation alert",
    body: alert.message,
    payload: { alertId: alert.id, busId: input.busId },
  });
  if (input.driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: input.driverId } });
    if (driver) {
      await notifyUser({
        userId: driver.userId,
        type: "ROUTE_DEVIATION",
        title: "Driving alert",
        body: alert.message,
        payload: { alertId: alert.id },
      });
    }
  }
}

function ownerScope(req: Request) {
  return ownerCompanyId(req).catch(() => undefined);
}

export async function complianceSummary(req: Request) {
  const companyId = await ownerScope(req);
  const cities = await policeCityScope(req);
  const staleBefore = new Date(Date.now() - env.GPS_STALE_SECONDS * 1000);
  const busWhere = {
    deletedAt: null,
    routeId: { not: null },
    companyId,
    ...(cities ? { AND: [busPlaceWhere(cities)] } : {}),
  };
  const routeWhere = {
    deletedAt: null,
    status: "ACTIVE" as const,
    companyId,
    ...(cities ? routePlaceWhere(cities) : {}),
  };
  const [activeRoutes, assigned, states, deviationsToday, staleGps] = await Promise.all([
    prisma.route.count({ where: routeWhere }),
    prisma.bus.count({ where: busWhere }),
    prisma.routeComplianceState.groupBy({
      by: ["status"],
      where: { bus: busWhere },
      _count: { _all: true },
    }),
    prisma.routeComplianceEvent.count({
      where: {
        toStatus: "OFF_ROUTE",
        createdAt: { gte: startOfDayDhaka() },
        bus: busWhere,
      },
    }),
    prisma.gpsLatestLocation.count({
      where: {
        timestamp: { lt: staleBefore },
        bus: busWhere,
      },
    }),
  ]);
  const count = (status: RouteComplianceStatus) => states.find((s) => s.status === status)?._count._all ?? 0;
  return {
    method: "RULE_BASED",
    dataLabel: "SIMULATED GPS / RULE-BASED COMPLIANCE",
    thresholds: complianceThresholds(),
    activeRoutes,
    assignedVehicles: assigned,
    vehiclesOnRoute: count("ON_ROUTE") + count("NEAR_ROUTE"),
    vehiclesNearRoute: count("NEAR_ROUTE"),
    vehiclesDeviating: count("DEVIATING"),
    vehiclesOffRoute: count("OFF_ROUTE"),
    vehiclesStale: staleGps,
    deviationsToday,
  };
}

export async function routeCompliance(req: Request, routeId: string) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, deletedAt: null },
    select: { id: true, companyId: true, isDemo: true, city: true },
  });
  if (!route) throw new ApiError("Route not found", 404);
  const companyId = await ownerScope(req);
  if (companyId && route.companyId && route.companyId !== companyId && !route.isDemo) {
    throw new ApiError("You cannot access another operator's route compliance", 403);
  }
  const cities = await policeCityScope(req);
  if (cities && !cities.some((city) => city.toLowerCase() === route.city.toLowerCase())) {
    throw new ApiError("This route is outside your assigned place", 403);
  }
  const buses = await prisma.bus.findMany({
    where: { deletedAt: null, routeId, companyId },
    include: {
      complianceState: true,
      latestLoc: true,
      company: { select: { id: true, name: true } },
    },
  });
  return {
    routeId,
    method: "RULE_BASED",
    dataLabel: "SIMULATED GPS / RULE-BASED COMPLIANCE",
    thresholds: complianceThresholds(),
    vehicles: buses.map((bus) => {
      const stale = bus.latestLoc ? trackingState(bus.latestLoc.timestamp) === "STALE" : true;
      const stored = bus.complianceState?.status ?? "UNASSIGNED";
      return {
        busId: bus.id,
        registrationNo: bus.registrationNo,
        companyId: bus.companyId,
        status: stale ? "STALE" : stored,
        storedStatus: stored,
        deviationM: bus.complianceState?.deviationM == null ? null : Number(bus.complianceState.deviationM),
        lastGpsAt: bus.latestLoc?.timestamp ?? null,
        latitude: bus.latestLoc ? Number(bus.latestLoc.latitude) : null,
        longitude: bus.latestLoc ? Number(bus.latestLoc.longitude) : null,
      };
    }),
  };
}

export async function busCompliance(req: Request, busId: string) {
  const bus = await prisma.bus.findFirst({
    where: { id: busId, deletedAt: null },
    include: {
      complianceState: { include: { route: { select: { code: true, name: true } } } },
      latestLoc: true,
      route: { select: { id: true, code: true, name: true, polyline: true } },
    },
  });
  if (!bus) throw new ApiError("Vehicle not found", 404);
  const companyId = await ownerScope(req);
  if (companyId && bus.companyId !== companyId) {
    throw new ApiError("You cannot access another operator's resources", 403);
  }
  const stale = bus.latestLoc ? trackingState(bus.latestLoc.timestamp) === "STALE" : true;
  const stored = bus.complianceState;
  return {
    ...projectComplianceState({
      busId: bus.id,
      routeId: stored?.routeId ?? bus.routeId,
      status: stale ? "STALE" : (stored?.status ?? "UNASSIGNED"),
      deviationM: stored?.deviationM ?? null,
      consecutiveOff: stored?.consecutiveOff ?? 0,
      consecutiveOn: stored?.consecutiveOn ?? 0,
      updatedAt: stored?.updatedAt ?? bus.updatedAt,
      bus,
      route: stored?.route ?? bus.route,
    }),
    lastGpsAt: bus.latestLoc?.timestamp ?? null,
    latitude: bus.latestLoc ? Number(bus.latestLoc.latitude) : null,
    longitude: bus.latestLoc ? Number(bus.latestLoc.longitude) : null,
    trackingState: stale ? "STALE" : "ONLINE",
  };
}

export async function listComplianceEvents(req: Request, routeId?: string, busId?: string) {
  const companyId = await ownerScope(req);
  const cities = await policeCityScope(req);
  const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
  const where = {
    routeId,
    busId,
    bus: cities
      ? { ...(companyId ? { companyId } : {}), AND: [busPlaceWhere(cities)] }
      : companyId ? { companyId } : undefined,
  };
  const [items, total] = await Promise.all([
    prisma.routeComplianceEvent.findMany({
      where,
      include: {
        bus: { select: { registrationNo: true, companyId: true } },
        route: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.routeComplianceEvent.count({ where }),
  ]);
  return {
    items: items.map((row) => ({
      id: row.id,
      busId: row.busId,
      registrationNo: row.bus.registrationNo,
      routeId: row.routeId,
      routeCode: row.route?.code ?? null,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      deviationM: row.deviationM == null ? null : Number(row.deviationM),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      createdAt: row.createdAt,
    })),
    page,
    pageSize,
    total,
    method: "RULE_BASED",
  };
}

function startOfDayDhaka() {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  return new Date(`${s}T00:00:00+06:00`);
}
