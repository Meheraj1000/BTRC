import { AlertSeverity, AlertType, GpsDataSource, type RoleCode } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { prisma } from "../lib/prisma.js";
import { broadcastAlert, broadcastBusLocation } from "../lib/socket.js";
import { ApiError } from "../lib/apiResponse.js";
import { parsePolyline, remainingDistanceKm, ruleBasedEtaMinutes } from "../utils/geo.js";
import { busExperiencingIssue } from "../utils/busIssue.js";
import { toOperationalGpsDto, toPublicGpsDto } from "../utils/gpsDto.js";
import { openIssueBusIds } from "./busIssue.service.js";
import { assertGpsJump, parseGpsTimestamp } from "../utils/gpsQuality.js";
import { hasPermission } from "../utils/permissions.js";
import { notifyCompanyOwner, notifyRoles, notifyUser } from "./notification.service.js";
import { evaluateAndPersistCompliance } from "./routeCompliance.service.js";

export type GpsIngest = {
  busId: string;
  deviceId?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp?: string;
  routeId?: string;
  driverId?: string;
  tripId?: string;
  source?: GpsDataSource;
};

const recentAlertKey = new Map<string, number>();

function shouldEmit(key: string, cooldownMs = 120000) {
  const last = recentAlertKey.get(key) ?? 0;
  if (Date.now() - last < cooldownMs) return false;
  recentAlertKey.set(key, Date.now());
  return true;
}

async function assertCanIngest(actor: { id: string; roles: RoleCode[] } | undefined, bus: { id: string; driverId: string | null }) {
  if (!actor) throw new ApiError("Authentication required", 401);
  if (hasPermission(actor.roles, "gps.manage") || actor.roles.includes("SUPER_ADMIN")) return;
  if (actor.roles.includes("DRIVER") && hasPermission(actor.roles, "gps.ingest")) {
    const driver = await prisma.driver.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!driver || bus.driverId !== driver.id) {
      throw new ApiError("You can only submit GPS for your assigned vehicle", 403);
    }
    return;
  }
  throw new ApiError("Insufficient permission to submit GPS", 403);
}

export async function ingestLocation(
  input: GpsIngest,
  actor?: { id: string; roles: RoleCode[] },
  options?: { viaDevice?: boolean },
) {
  const bus = await prisma.bus.findFirst({
    where: { id: input.busId, deletedAt: null },
    include: { route: true, driver: { include: { user: true } } },
  });
  if (!bus) throw new ApiError("Bus not found", 404);
  if (options?.viaDevice) {
    if (!bus.gpsDeviceId || (input.deviceId && input.deviceId !== bus.gpsDeviceId)) {
      throw new ApiError("This GPS device is not connected to the vehicle", 403);
    }
  } else {
    await assertCanIngest(actor, bus);
  }

  const timestamp = parseGpsTimestamp(input.timestamp);
  const previous = await prisma.gpsLatestLocation.findUnique({ where: { busId: bus.id } });
  assertGpsJump(previous, { latitude: input.latitude, longitude: input.longitude, timestamp });

  const source = options?.viaDevice
    ? "DEVICE"
    : (input.source ?? (env.GPS_SOURCE_MODE === "DEVICE" ? "DEVICE" : "SIMULATION"));
  const tripId = input.tripId ?? undefined;
  const routeId = bus.routeId ?? undefined;
  const driverId = bus.driverId ?? undefined;

  await prisma.$transaction([
    prisma.gpsLocation.create({
      data: {
        busId: bus.id,
        deviceId: input.deviceId ?? bus.gpsDeviceId,
        tripId,
        routeId,
        driverId,
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed,
        heading: input.heading,
        timestamp,
        source,
      },
    }),
    prisma.gpsLatestLocation.upsert({
      where: { busId: bus.id },
      create: {
        busId: bus.id,
        deviceId: input.deviceId ?? bus.gpsDeviceId,
        tripId,
        routeId,
        driverId,
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed,
        heading: input.heading,
        timestamp,
        source,
      },
      update: {
        deviceId: input.deviceId ?? bus.gpsDeviceId,
        tripId,
        routeId,
        driverId,
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed,
        heading: input.heading,
        timestamp,
        source,
      },
    }),
  ]);

  if (tripId) {
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        maxSpeed: { set: undefined },
      },
    }).catch(() => undefined);

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (trip) {
      const max = Math.max(Number(trip.maxSpeed ?? 0), input.speed);
      await prisma.trip.update({
        where: { id: tripId },
        data: { maxSpeed: max },
      });
    }
  }

  const allowedSpeed = bus.route?.allowedSpeed ?? 40;
  const overspeed = input.speed > allowedSpeed + env.GPS_OVERSPEED_MARGIN_KMH;

  const compliance = await evaluateAndPersistCompliance({
    busId: bus.id,
    registrationNo: bus.registrationNo,
    companyId: bus.companyId,
    routeId: bus.routeId,
    polyline: bus.route?.polyline,
    routeCode: bus.route?.code,
    routeName: bus.route?.name,
    latitude: input.latitude,
    longitude: input.longitude,
    timestamp,
    previousTimestamp: previous?.timestamp,
    driverId,
    tripId,
  });

  const openCases = await openIssueBusIds();
  const hasIssue = busExperiencingIssue({
    complianceStatus: compliance.status,
    operationalStatus: bus.operationalStatus,
    speed: input.speed,
    allowedSpeed,
    overspeedMargin: env.GPS_OVERSPEED_MARGIN_KMH,
    openCase: openCases.has(bus.id),
  });
  const statusColor: "GREEN" | "YELLOW" | "RED" = hasIssue ? "RED" : "GREEN";

  const row = {
    busId: bus.id,
    registrationNo: bus.registrationNo,
    deviceId: input.deviceId ?? bus.gpsDeviceId,
    latitude: input.latitude,
    longitude: input.longitude,
    speed: input.speed,
    heading: input.heading,
    timestamp,
    routeId: routeId ?? null,
    driverId: driverId ?? null,
    tripId: tripId ?? null,
    allowedSpeed,
    statusColor,
    hasIssue,
    source,
    complianceStatus: compliance.status,
    deviationM: compliance.deviationM,
    bus: {
      registrationNo: bus.registrationNo,
      operationalStatus: bus.operationalStatus,
      routeId: bus.routeId,
      driverId: bus.driverId,
      companyId: bus.companyId,
      route: bus.route ? { name: bus.route.name, allowedSpeed: bus.route.allowedSpeed } : null,
    },
  };
  const publicDto = toPublicGpsDto(row);
  const operationalDto = toOperationalGpsDto(row);

  try {
    broadcastBusLocation(publicDto, operationalDto);
  } catch {
    // ignore during tests
  }

  if (overspeed && shouldEmit(`overspeed:${bus.id}`)) {
    await raiseAlert({
      type: AlertType.OVERSPEED,
      severity: input.speed > allowedSpeed + 20 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      busId: bus.id,
      driverId,
      tripId,
      routeId,
      latitude: input.latitude,
      longitude: input.longitude,
      speed: input.speed,
      allowedSpeed,
      message: `Overspeed ${input.speed} km/h (limit ${allowedSpeed}) on ${bus.registrationNo}`,
    });
  }

  logger.info("gps_ingest", { busId: bus.id, speed: input.speed, source });
  return operationalDto;
}

async function raiseAlert(data: {
  type: AlertType;
  severity: AlertSeverity;
  busId?: string;
  driverId?: string | null;
  tripId?: string;
  routeId?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  allowedSpeed?: number;
  deviationM?: number;
  message: string;
}) {
  const alert = await prisma.alert.create({
    data: {
      type: data.type,
      severity: data.severity,
      busId: data.busId,
      driverId: data.driverId ?? undefined,
      tripId: data.tripId,
      routeId: data.routeId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      allowedSpeed: data.allowedSpeed,
      deviationM: data.deviationM,
      message: data.message,
      dataSource: env.GPS_SOURCE_MODE === "DEVICE" ? "REAL" : "SIMULATED",
    },
  });

  if (data.driverId && (data.type === "OVERSPEED" || data.type === "ROUTE_DEVIATION")) {
    await prisma.violation.create({
      data: {
        busId: data.busId,
        driverId: data.driverId,
        type: data.type,
        description: data.message,
        latitude: data.latitude,
        longitude: data.longitude,
        dataSource: env.GPS_SOURCE_MODE === "DEVICE" ? "REAL" : "SIMULATED",
      },
    });
    await prisma.driver.update({
      where: { id: data.driverId },
      data: {
        violationCount: { increment: 1 },
        performanceScore: { decrement: 1.5 },
      },
    }).catch(() => undefined);
  }

  const companyId = data.busId
    ? (await prisma.bus.findUnique({ where: { id: data.busId }, select: { companyId: true } }))?.companyId
    : null;
  try {
    broadcastAlert(alert, companyId);
  } catch {
    // ignore
  }

  const nType = data.type === "OVERSPEED" ? "OVERSPEEDING" : "ROUTE_DEVIATION";
  await notifyRoles(["SUPER_ADMIN", "GOVERNMENT", "POLICE", "BRTA"], {
    type: nType,
    title: data.type === "OVERSPEED" ? "Overspeed alert" : "Route deviation alert",
    body: data.message,
    payload: { alertId: alert.id, busId: data.busId },
  });
  await notifyCompanyOwner(companyId, {
    type: nType,
    title: data.type === "OVERSPEED" ? "Overspeed alert" : "Route deviation alert",
    body: data.message,
    payload: { alertId: alert.id, busId: data.busId },
  });

  if (data.driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
    if (driver) {
      await notifyUser({
        userId: driver.userId,
        type: nType,
        title: "Driving alert",
        body: data.message,
        payload: { alertId: alert.id },
      });
    }
  }

  return alert;
}

const latestInclude = {
  bus: {
    select: {
      id: true,
      registrationNo: true,
      operationalStatus: true,
      routeId: true,
      driverId: true,
      companyId: true,
      route: { select: { name: true, allowedSpeed: true, city: true } },
      complianceState: { select: { status: true, deviationM: true } },
    },
  },
} as const;

export async function getLatestLocations(busIds?: string[]) {
  return prisma.gpsLatestLocation.findMany({
    where: busIds?.length ? { busId: { in: busIds } } : undefined,
    include: latestInclude,
  });
}

export async function getLatestLocationsNear(lat: number, lng: number, radiusM: number) {
  const degLat = radiusM / 111_320;
  const cos = Math.cos((lat * Math.PI) / 180);
  const degLng = radiusM / (111_320 * Math.max(0.2, Math.abs(cos)));
  return prisma.gpsLatestLocation.findMany({
    where: {
      latitude: { gte: lat - degLat, lte: lat + degLat },
      longitude: { gte: lng - degLng, lte: lng + degLng },
    },
    include: latestInclude,
  });
}

export async function getLocationHistory(
  busId: string,
  from?: Date,
  to?: Date,
  page = 1,
  pageSize = 50,
) {
  const take = Math.min(Math.max(pageSize, 1), 200);
  const skip = (Math.max(page, 1) - 1) * take;
  const where = {
    busId,
    timestamp: {
      gte: from,
      lte: to,
    },
  };
  const [items, total] = await Promise.all([
    prisma.gpsLocation.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take,
    }),
    prisma.gpsLocation.count({ where }),
  ]);
  return { items, total, page, pageSize: take };
}

export async function estimateArrival(busId: string) {
  const latest = await prisma.gpsLatestLocation.findUnique({
    where: { busId },
    include: { bus: { include: { route: true } } },
  });
  if (!latest?.bus.route) {
    return {
      method: "RULE_BASED_PROTOTYPE",
      etaMinutes: null,
      note: "No active route or location available.",
    };
  }
  const line = parsePolyline(latest.bus.route.polyline);
  const remaining = remainingDistanceKm(
    { lat: Number(latest.latitude), lng: Number(latest.longitude) },
    line,
  );
  const hour = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false });
  const eta = ruleBasedEtaMinutes(remaining, Number(latest.speed), Number(hour));
  return {
    method: "RULE_BASED_PROTOTYPE",
    dataLabel: latest.source === "DEVICE" ? "REAL" : "SIMULATED",
    remainingKm: Math.round(remaining * 100) / 100,
    currentSpeed: Number(latest.speed),
    etaMinutes: eta,
    note: "Heuristic ETA only. ML ETA is experimental and lives in the /ml research module.",
  };
}
