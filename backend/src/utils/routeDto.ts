import type { RouteComplianceStatus, UserStatus } from "@prisma/client";
import { ApiError } from "../lib/apiResponse.js";
import { isValidLatLng, parsePolyline, type LatLng } from "./geo.js";

export type RouteStopInput = {
  name: string;
  sequence: number;
  latitude: number;
  longitude: number;
  dwellSeconds?: number;
};

export function assertCoordinate(lat: number, lng: number, label = "Coordinate") {
  if (!isValidLatLng(lat, lng)) {
    throw new ApiError(`${label} is outside valid latitude/longitude bounds`, 422);
  }
}

export function assertPolyline(raw: unknown): LatLng[] {
  const line = parsePolyline(raw);
  if (line.length < 2) {
    throw new ApiError("Route geometry must contain at least two valid coordinates", 422);
  }
  for (const point of line) {
    assertCoordinate(point.lat, point.lng, "Route geometry point");
  }
  return line;
}

export function assertStops(stops: RouteStopInput[]) {
  const seen = new Set<number>();
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  for (const stop of ordered) {
    if (!stop.name?.trim()) throw new ApiError("Stop name is required", 422);
    if (!Number.isInteger(stop.sequence) || stop.sequence < 1) {
      throw new ApiError("Stop sequence must be a positive integer", 422);
    }
    if (seen.has(stop.sequence)) {
      throw new ApiError(`Duplicate stop sequence ${stop.sequence}`, 422);
    }
    seen.add(stop.sequence);
    assertCoordinate(stop.latitude, stop.longitude, `Stop "${stop.name}"`);
  }
  return ordered;
}

export function routeCompanyCompatible(
  route: { companyId: string | null; isDemo: boolean },
  busCompanyId: string,
) {
  if (!route.companyId) return true;
  if (route.companyId === busCompanyId) return true;
  return route.isDemo;
}

export function projectRoute<T extends {
  id: string;
  code: string;
  name: string;
  startName: string;
  endName: string;
  startLat: unknown;
  startLng: unknown;
  endLat: unknown;
  endLng: unknown;
  city: string;
  allowedSpeed: number;
  polyline: unknown;
  status: UserStatus;
  companyId: string | null;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
  company?: { id: string; name: string } | null;
  stops?: Array<{
    id: string;
    name: string;
    sequence: number;
    latitude: unknown;
    longitude: unknown;
    dwellSeconds: number;
  }>;
  buses?: Array<{ id: string; registrationNo: string; operationalStatus: string }>;
  _count?: { buses?: number };
}>(route: T) {
  return {
    id: route.id,
    code: route.code.trim(),
    name: route.name,
    startName: route.startName,
    endName: route.endName,
    startLat: Number(route.startLat),
    startLng: Number(route.startLng),
    endLat: Number(route.endLat),
    endLng: Number(route.endLng),
    city: route.city,
    allowedSpeed: route.allowedSpeed,
    polyline: parsePolyline(route.polyline),
    status: route.status,
    companyId: route.companyId,
    isDemo: route.isDemo,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
    company: route.company ?? null,
    stops: (route.stops ?? [])
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((stop) => ({
        id: stop.id,
        name: stop.name,
        sequence: stop.sequence,
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        dwellSeconds: stop.dwellSeconds,
      })),
    assignedVehicleCount: route._count?.buses ?? route.buses?.length ?? 0,
    buses: route.buses,
  };
}

export function projectComplianceState(row: {
  busId: string;
  routeId: string | null;
  status: RouteComplianceStatus;
  deviationM: unknown;
  consecutiveOff: number;
  consecutiveOn: number;
  updatedAt: Date;
  bus?: { registrationNo?: string; companyId?: string; operationalStatus?: string } | null;
  route?: { code?: string; name?: string } | null;
}) {
  return {
    busId: row.busId,
    registrationNo: row.bus?.registrationNo ?? null,
    companyId: row.bus?.companyId ?? null,
    operationalStatus: row.bus?.operationalStatus ?? null,
    routeId: row.routeId,
    routeCode: row.route?.code ?? null,
    routeName: row.route?.name ?? null,
    status: row.status,
    deviationM: row.deviationM == null ? null : Number(row.deviationM),
    consecutiveOff: row.consecutiveOff,
    consecutiveOn: row.consecutiveOn,
    updatedAt: row.updatedAt,
    method: "RULE_BASED" as const,
    dataLabel: "SIMULATED GPS / RULE-BASED COMPLIANCE",
  };
}

export type RouteWriteInput = {
  code: string;
  name: string;
  startName: string;
  endName: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  city: string;
  allowedSpeed?: number;
  polyline: LatLng[];
  companyId?: string | null;
  stops?: RouteStopInput[];
};
