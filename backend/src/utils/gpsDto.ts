import type { RoleCode, RouteComplianceStatus } from "@prisma/client";
import { trackingState, type TrackingState } from "./gpsQuality.js";

export const OPERATIONAL_GPS_ROLES: RoleCode[] = [
  "SUPER_ADMIN",
  "GOVERNMENT",
  "BRTA",
  "POLICE",
  "TRANSPORT_OWNER",
];

export function canSeeOperationalGps(roles?: RoleCode[]) {
  return Boolean(roles?.some((r) => OPERATIONAL_GPS_ROLES.includes(r)));
}

export type PublicGpsDto = {
  projection: "PUBLIC";
  busId: string;
  registrationNo: string | null;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  statusColor: "GREEN" | "YELLOW" | "RED";
  hasIssue: boolean;
  routeName: string | null;
  dataLabel: "REAL" | "SIMULATED";
  trackingState: TrackingState;
};

export type OperationalGpsDto = Omit<PublicGpsDto, "projection"> & {
  projection: "OPERATIONAL";
  deviceId: string | null;
  routeId: string | null;
  driverId: string | null;
  tripId: string | null;
  companyId: string | null;
  city: string | null;
  allowedSpeed: number | null;
  operationalStatus: string | null;
  complianceStatus?: RouteComplianceStatus | null;
  deviationM?: number | null;
};

type GpsRow = {
  busId: string;
  deviceId?: string | null;
  tripId?: string | null;
  routeId?: string | null;
  driverId?: string | null;
  latitude: unknown;
  longitude: unknown;
  speed: unknown;
  heading?: unknown;
  timestamp: Date | string;
  source?: string;
  statusColor?: "GREEN" | "YELLOW" | "RED";
  hasIssue?: boolean;
  registrationNo?: string | null;
  allowedSpeed?: number | null;
  complianceStatus?: RouteComplianceStatus | null;
  deviationM?: number | null;
  bus?: {
    id?: string;
    registrationNo?: string;
    operationalStatus?: string;
    routeId?: string | null;
    driverId?: string | null;
    companyId?: string | null;
    route?: { name?: string; allowedSpeed?: number; city?: string | null } | null;
    complianceState?: { status?: RouteComplianceStatus | null; deviationM?: unknown } | null;
  } | null;
};

function num(v: unknown) {
  return Number(v);
}

function iso(v: Date | string) {
  return v instanceof Date ? v.toISOString() : String(v);
}

export function toPublicGpsDto(row: GpsRow): PublicGpsDto {
  const speed = num(row.speed);
  return {
    projection: "PUBLIC",
    busId: row.busId,
    registrationNo: row.registrationNo ?? row.bus?.registrationNo ?? null,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    speed,
    heading: num(row.heading ?? 0),
    timestamp: iso(row.timestamp),
    statusColor: row.hasIssue ? "RED" : (row.statusColor ?? (speed > 50 ? "YELLOW" : "GREEN")),
    hasIssue: Boolean(row.hasIssue) || row.statusColor === "RED",
    routeName: row.bus?.route?.name ?? null,
    dataLabel: row.source === "DEVICE" ? "REAL" : "SIMULATED",
    trackingState: trackingState(row.timestamp),
  };
}

export function toOperationalGpsDto(row: GpsRow): OperationalGpsDto {
  return {
    ...toPublicGpsDto(row),
    projection: "OPERATIONAL",
    deviceId: row.deviceId ?? null,
    routeId: row.routeId ?? row.bus?.routeId ?? null,
    driverId: row.driverId ?? row.bus?.driverId ?? null,
    tripId: row.tripId ?? null,
    companyId: row.bus?.companyId ?? null,
    city: row.bus?.route?.city ?? null,
    allowedSpeed: row.allowedSpeed ?? row.bus?.route?.allowedSpeed ?? null,
    operationalStatus: row.bus?.operationalStatus ?? null,
    complianceStatus: row.complianceStatus ?? row.bus?.complianceState?.status ?? null,
    deviationM: row.deviationM ?? (row.bus?.complianceState?.deviationM == null ? null : Number(row.bus.complianceState.deviationM)),
  };
}

export function projectGps(row: GpsRow, roles?: RoleCode[]) {
  return canSeeOperationalGps(roles) ? toOperationalGpsDto(row) : toPublicGpsDto(row);
}

export function assertNoSensitiveGps(payload: Record<string, unknown>) {
  return !("deviceId" in payload) && !("driverId" in payload) && !("tripId" in payload);
}
