import type { Prisma, RoleCode } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { busPlaceWhere, driverPlaceWhere, placeRecordFilter, routePlaceWhere } from "../utils/policeArea.js";
import { hasPermission } from "../utils/permissions.js";
import { pagination } from "../utils/scope.js";

export type OverviewScope = {
  companyId?: string;
  roles?: RoleCode[];
  cities?: string[];
};

function busesFor(scope: OverviewScope): Prisma.BusWhereInput {
  const where: Prisma.BusWhereInput = { deletedAt: null };
  if (scope.companyId) where.companyId = scope.companyId;
  if (scope.cities) where.AND = [busPlaceWhere(scope.cities)];
  return where;
}

function driversFor(scope: OverviewScope): Prisma.DriverWhereInput {
  const where: Prisma.DriverWhereInput = { deletedAt: null };
  if (scope.companyId) where.companyId = scope.companyId;
  if (scope.cities) where.AND = [driverPlaceWhere(scope.cities)];
  return where;
}

function problemsFor(scope: OverviewScope) {
  if (scope.cities) return placeRecordFilter(scope.cities);
  if (scope.companyId) return { bus: { is: { companyId: scope.companyId } } };
  return {};
}

function scopedLabel(scope: OverviewScope) {
  if (scope.cities) return "PLACE";
  if (scope.companyId) return "COMPANY";
  return "DEPLOYMENT";
}

function staleBefore() {
  return new Date(Date.now() - env.GPS_STALE_SECONDS * 1000);
}

export async function overview(scope: OverviewScope = {}) {
  const roles = scope.roles ?? [];
  const buses = busesFor(scope);
  const drivers = driversFor(scope);
  const problems = problemsFor(scope);
  const stale = staleBefore();
  const today = startOfDayDhaka();
  const routeWhere: Prisma.RouteWhereInput = { deletedAt: null };
  if (scope.companyId) routeWhere.companyId = scope.companyId;
  if (scope.cities) routeWhere.AND = [routePlaceWhere(scope.cities)];
  const tripBus = scope.companyId || scope.cities ? buses : undefined;

  const [
    totalBuses,
    activeBuses,
    inactiveBuses,
    offlineBuses,
    suspendedVehicles,
    pendingVehicleVerification,
    verifiedVehicles,
    totalDrivers,
    activeDrivers,
    suspendedDrivers,
    pendingLicense,
    verifiedDrivers,
    expiredLicense,
    totalRoutes,
    activeRoutes,
    vehiclesOnline,
    vehiclesStale,
    complianceGroups,
    deviationsToday,
    overspeeding,
    emergencyAlerts,
    complaints,
    openSos,
    totalPassengers,
    activeTrips,
  ] = await Promise.all([
    prisma.bus.count({ where: buses }),
    prisma.bus.count({ where: { ...buses, operationalStatus: "ACTIVE" } }),
    prisma.bus.count({ where: { ...buses, operationalStatus: "INACTIVE" } }),
    prisma.bus.count({ where: { ...buses, operationalStatus: "OFFLINE" } }),
    prisma.bus.count({ where: { ...buses, registrationStatus: "SUSPENDED" } }),
    prisma.bus.count({
      where: {
        ...buses,
        OR: [{ registrationStatus: "PENDING" }, { fitnessStatus: "PENDING" }],
      },
    }),
    prisma.bus.count({ where: { ...buses, registrationStatus: "ACTIVE", fitnessStatus: "FIT" } }),
    prisma.driver.count({ where: drivers }),
    prisma.driver.count({ where: { ...drivers, status: "ACTIVE" } }),
    prisma.driver.count({ where: { ...drivers, status: "SUSPENDED" } }),
    prisma.driver.count({ where: { ...drivers, licenseStatus: "PENDING" } }),
    prisma.driver.count({ where: { ...drivers, licenseStatus: "VALID" } }),
    prisma.driver.count({ where: { ...drivers, licenseStatus: "EXPIRED" } }),
    prisma.route.count({ where: routeWhere }),
    prisma.route.count({ where: { ...routeWhere, status: "ACTIVE" } }),
    prisma.gpsLatestLocation.count({ where: { timestamp: { gte: stale }, bus: buses } }),
    prisma.gpsLatestLocation.count({ where: { timestamp: { lt: stale }, bus: buses } }),
    prisma.routeComplianceState.groupBy({
      by: ["status"],
      where: { bus: buses },
      _count: { _all: true },
    }),
    prisma.routeComplianceEvent.count({
      where: { toStatus: "OFF_ROUTE", createdAt: { gte: today }, bus: tripBus },
    }),
    prisma.alert.count({ where: { type: "OVERSPEED", createdAt: { gte: today }, ...problems } }),
    prisma.alert.count({ where: { type: { in: ["SOS", "ACCIDENT"] }, status: "OPEN", ...problems } }),
    prisma.complaint.count({
      where: {
        status: { in: ["PENDING", "UNDER_REVIEW"] },
        ...problems,
      },
    }),
    prisma.sosRequest.count({
      where: {
        status: { in: ["OPEN", "ACKNOWLEDGED", "DISPATCHED", "INVESTIGATING", "RESPONDING"] },
        ...problems,
      },
    }),
    prisma.passenger.count({ where: { deletedAt: null } }),
    prisma.trip.count({
      where: { status: "IN_PROGRESS", bus: tripBus },
    }),
  ]);

  const complianceCount = (status: string) => complianceGroups.find((s) => s.status === status)?._count._all ?? 0;
  const cards: Record<string, number> = {
    totalBuses,
    activeBuses,
    inactiveBuses,
    offlineBuses,
    suspendedVehicles,
    pendingVehicleVerification,
    verifiedVehicles,
    totalDrivers,
    activeDrivers,
    suspendedDrivers,
    pendingLicense,
    verifiedDrivers,
    expiredLicense,
    totalRoutes,
    activeRoutes,
    vehiclesOnline,
    vehiclesStale,
    vehiclesOnRoute: complianceCount("ON_ROUTE") + complianceCount("NEAR_ROUTE"),
    vehiclesNearRoute: complianceCount("NEAR_ROUTE"),
    vehiclesDeviating: complianceCount("DEVIATING"),
    vehiclesOffRoute: complianceCount("OFF_ROUTE"),
    deviationsToday,
    overspeedingAlerts: overspeeding,
    activeTrips,
    complaints,
    routeViolations: deviationsToday,
  };

  if (hasPermission(roles, "sos.read")) {
    cards.emergencyAlerts = emergencyAlerts;
    cards.openSos = openSos;
  }
  if (roles.includes("SUPER_ADMIN") || roles.includes("GOVERNMENT")) {
    cards.totalPassengers = totalPassengers;
  }

  return {
    dataLabel: "DEMO / SIMULATED operational metrics from this deployment",
    timezone: "Asia/Dhaka",
    method: "DATABASE_COUNTS",
    scope: scopedLabel(scope),
    verificationLabel: "MANUAL / SIMULATED VERIFICATION",
    cards,
  };
}

export async function series(scope: OverviewScope = {}) {
  const problems = problemsFor(scope);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  });
  const since = dhakaDayBounds(days[0]).gte;
  const busFilter = scope.companyId || scope.cities ? { bus: busesFor(scope) } : {};

  const [daily, breakdown] = await Promise.all([
    Promise.all(
      days.map(async (day) => {
        const range = dhakaDayBounds(day);
        const [trips, speed, route, sos, complaints] = await Promise.all([
          prisma.trip.count({ where: { startedAt: range, ...busFilter } }),
          prisma.alert.count({ where: { type: "OVERSPEED", createdAt: range, ...problems } }),
          prisma.alert.count({ where: { type: "ROUTE_DEVIATION", createdAt: range, ...problems } }),
          prisma.alert.count({ where: { type: "SOS", createdAt: range, ...problems } }),
          prisma.complaint.count({
            where: { createdAt: range, ...problems },
          }),
        ]);
        return { day, trips, speed, route, sos, complaints };
      }),
    ),
    prisma.complaint.groupBy({
      by: ["category"],
      where: { createdAt: { gte: since }, ...problems },
      _count: { _all: true },
    }),
  ]);

  return {
    dataLabel: "DEMO",
    scope: scopedLabel(scope),
    dailyTrips: daily.map((d) => ({ day: d.day, trips: d.trips })),
    speedViolations: daily.map((d) => ({ day: d.day, count: d.speed })),
    routeViolations: daily.map((d) => ({ day: d.day, count: d.route })),
    sosIncidents: daily.map((d) => ({ day: d.day, count: d.sos })),
    complaints: daily.map((d) => ({ day: d.day, count: d.complaints })),
    complaintBreakdown: breakdown.map((row) => ({ category: row.category, count: row._count._all })),
  };
}

export async function busAnalytics(scope: OverviewScope = {}, query: { page?: string; pageSize?: string } = {}) {
  const { skip, take, page, pageSize } = pagination(query);
  const where = busesFor(scope);
  const [rows, total] = await Promise.all([
    prisma.bus.findMany({
      where,
      include: {
        _count: { select: { trips: true, alerts: true, complaints: true } },
        latestLoc: true,
        company: { select: { name: true } },
        route: { select: { name: true, code: true } },
        complianceState: { select: { status: true, deviationM: true } },
      },
      orderBy: { registrationNo: "asc" },
      skip,
      take,
    }),
    prisma.bus.count({ where }),
  ]);
  return {
    dataLabel: "DEMO",
    page,
    pageSize,
    total,
    items: rows.map((b) => ({
      id: b.id,
      registrationNo: b.registrationNo,
      company: b.company.name,
      route: b.route?.name ?? null,
      routeCode: b.route?.code ?? null,
      status: b.operationalStatus,
      trips: b._count.trips,
      alerts: b._count.alerts,
      complaints: b._count.complaints,
      lastSeen: b.latestLoc?.timestamp ?? null,
      lastSpeed: b.latestLoc ? Number(b.latestLoc.speed) : null,
      complianceStatus: b.complianceState?.status ?? null,
    })),
  };
}

export async function driverAnalytics(scope: OverviewScope = {}, query: { page?: string; pageSize?: string } = {}) {
  const { skip, take, page, pageSize } = pagination(query);
  const where = driversFor(scope);
  const [rows, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      include: {
        user: { select: { fullName: true } },
        company: { select: { name: true } },
        buses: { where: { deletedAt: null }, select: { registrationNo: true } },
        _count: { select: { trips: true, alerts: true, violations: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.driver.count({ where }),
  ]);
  return {
    dataLabel: "DEMO",
    page,
    pageSize,
    total,
    items: rows.map((d) => ({
      id: d.id,
      name: d.user.fullName,
      company: d.company?.name ?? null,
      licenseStatus: d.licenseStatus,
      status: d.status,
      assignedVehicle: d.buses[0]?.registrationNo ?? null,
      trips: d._count.trips,
      alerts: d._count.alerts,
      violationCount: d._count.violations,
      performanceScore: Number(d.performanceScore),
    })),
  };
}

export async function routeAnalytics(scope: OverviewScope = {}, query: { page?: string; pageSize?: string } = {}) {
  const { skip, take, page, pageSize } = pagination(query);
  const where: Prisma.RouteWhereInput = { deletedAt: null };
  if (scope.companyId) where.companyId = scope.companyId;
  if (scope.cities) where.AND = [routePlaceWhere(scope.cities)];
  const [rows, total] = await Promise.all([
    prisma.route.findMany({
      where,
      include: { _count: { select: { buses: { where: { deletedAt: null } }, trips: true } } },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    prisma.route.count({ where }),
  ]);
  return {
    dataLabel: "DEMO",
    page,
    pageSize,
    total,
    items: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      city: r.city,
      startName: r.startName,
      endName: r.endName,
      status: r.status,
      allowedSpeed: r.allowedSpeed,
      buses: r._count.buses,
      trips: r._count.trips,
      isDemo: r.isDemo,
    })),
  };
}

export async function activity(scope: OverviewScope & { includeAudit?: boolean } = {}) {
  const problems = problemsFor(scope);
  const busFilter = scope.companyId || scope.cities ? { bus: busesFor(scope) } : {};
  const [alerts, events] = await Promise.all([
    prisma.alert.findMany({
      where: problems,
      include: {
        bus: { select: { registrationNo: true, companyId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.routeComplianceEvent.findMany({
      where: busFilter,
      include: {
        bus: { select: { registrationNo: true } },
        route: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const audit = scope.includeAudit
    ? await prisma.auditLog.findMany({
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    })
    : [];

  return {
    dataLabel: "DEMO / SIMULATED",
    scope: scopedLabel(scope),
    alerts: alerts.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      status: a.status,
      message: a.message,
      registrationNo: a.bus?.registrationNo ?? null,
      createdAt: a.createdAt,
    })),
    complianceEvents: events.map((e) => ({
      id: e.id,
      registrationNo: e.bus.registrationNo,
      routeCode: e.route?.code ?? null,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      createdAt: e.createdAt,
    })),
    audit: audit.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      createdAt: row.createdAt,
      actor: row.user?.fullName ?? null,
    })),
  };
}

function startOfDayDhaka() {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  return new Date(`${s}T00:00:00+06:00`);
}

function dhakaDayBounds(isoDate: string) {
  const start = new Date(`${isoDate}T00:00:00+06:00`);
  return { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
