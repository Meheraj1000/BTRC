import type { RoleCode, RouteComplianceStatus } from "@prisma/client";
import { trackingState } from "./gpsQuality.js";
import { qrPublicUrl } from "./qrToken.js";

const yearNow = new Date().getFullYear();

export const registrationNoSchema = {
  normalize(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, "-");
  },
  isValid(value: string) {
    return /^[A-Z0-9][A-Z0-9-]{3,30}[A-Z0-9]$/.test(value);
  },
};

export function assertRegistrationNo(value: string) {
  const registrationNo = registrationNoSchema.normalize(value);
  if (!registrationNoSchema.isValid(registrationNo)) {
    throw new Error("INVALID_REGISTRATION");
  }
  return registrationNo;
}

export function isVerifiedForService(bus: {
  registrationStatus: string;
  fitnessStatus: string;
}) {
  return bus.registrationStatus === "ACTIVE" && bus.fitnessStatus === "FIT";
}

export function canStartNormalTrip(bus: {
  deletedAt?: Date | null;
  operationalStatus: string;
  registrationStatus: string;
  fitnessStatus: string;
}) {
  if (bus.deletedAt) return false;
  if (bus.operationalStatus !== "ACTIVE") return false;
  if (bus.registrationStatus === "SUSPENDED" || bus.registrationStatus === "EXPIRED") return false;
  if (bus.fitnessStatus === "UNFIT" || bus.fitnessStatus === "EXPIRED") return false;
  return isVerifiedForService(bus);
}

export function tripBlockReason(bus: {
  deletedAt?: Date | null;
  operationalStatus: string;
  registrationStatus: string;
  fitnessStatus: string;
}) {
  if (bus.deletedAt) return "This vehicle has been archived";
  if (bus.operationalStatus === "MAINTENANCE") return "Vehicle is in maintenance and cannot start a trip";
  if (bus.operationalStatus === "OFFLINE" || bus.operationalStatus === "INACTIVE") {
    return "Vehicle is inactive or offline and cannot start a trip";
  }
  if (bus.registrationStatus === "SUSPENDED") return "Vehicle registration is suspended (manual / simulated verification)";
  if (bus.registrationStatus === "EXPIRED" || bus.registrationStatus === "PENDING") {
    return "Vehicle registration is not active (manual / simulated verification)";
  }
  if (bus.fitnessStatus === "UNFIT" || bus.fitnessStatus === "EXPIRED" || bus.fitnessStatus === "PENDING") {
    return "Vehicle fitness is not approved (manual / simulated verification)";
  }
  return "Vehicle is not cleared for a normal trip";
}

export const YEAR_MIN = 1980;
export const YEAR_MAX = yearNow + 1;

type BusRow = {
  id: string;
  registrationNo: string;
  qrToken?: string | null;
  vehicleType: string;
  manufacturer: string | null;
  model: string | null;
  capacity: number;
  yearOfManufacture: number | null;
  operationalStatus: string;
  fitnessStatus: string;
  registrationStatus: string;
  insuranceStatus: string;
  companyId: string;
  routeId: string | null;
  driverId: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: { id?: string; name?: string } | null;
  route?: { id?: string; name?: string; code?: string; allowedSpeed?: number } | null;
  driver?: { id?: string; user?: { fullName?: string } | null } | null;
  latestLoc?: {
    latitude: unknown;
    longitude: unknown;
    speed: unknown;
    heading: unknown;
    timestamp: Date;
    source?: string;
  } | null;
  complianceState?: { status?: RouteComplianceStatus | null; deviationM?: unknown } | null;
};

export function projectBus(bus: BusRow, roles: RoleCode[]) {
  const qrToken = bus.qrToken ?? null;
  const base = {
    id: bus.id,
    registrationNo: bus.registrationNo,
    qrToken,
    qrUrl: qrToken ? qrPublicUrl(qrToken) : null,
    vehicleType: bus.vehicleType,
    capacity: bus.capacity,
    operationalStatus: bus.operationalStatus,
    verificationLabel: "MANUAL / SIMULATED VERIFICATION",
    company: bus.company ? { id: bus.company.id, name: bus.company.name } : { id: bus.companyId, name: null },
    route: bus.route ? { id: bus.route.id, name: bus.route.name, code: bus.route.code } : null,
    createdAt: bus.createdAt,
    updatedAt: bus.updatedAt,
  };

  if (roles.includes("PASSENGER") && !roles.some((r) => ["SUPER_ADMIN", "GOVERNMENT", "BRTA", "POLICE", "TRANSPORT_OWNER", "DRIVER"].includes(r))) {
    return {
      ...base,
      driver: bus.driver ? { name: bus.driver.user?.fullName ?? null } : null,
      latestLoc: bus.latestLoc
        ? {
            latitude: Number(bus.latestLoc.latitude),
            longitude: Number(bus.latestLoc.longitude),
            speed: Number(bus.latestLoc.speed),
            timestamp: bus.latestLoc.timestamp,
          }
        : null,
    };
  }

  if (roles.includes("POLICE") && !roles.includes("SUPER_ADMIN")) {
    return {
      ...base,
      fitnessStatus: bus.fitnessStatus,
      driver: bus.driver ? { id: bus.driver.id, name: bus.driver.user?.fullName ?? null } : null,
      latestLoc: bus.latestLoc
        ? {
            latitude: Number(bus.latestLoc.latitude),
            longitude: Number(bus.latestLoc.longitude),
            speed: Number(bus.latestLoc.speed),
            heading: Number(bus.latestLoc.heading),
            timestamp: bus.latestLoc.timestamp,
          }
        : null,
      trackingState: bus.latestLoc ? trackingState(bus.latestLoc.timestamp) : "STALE",
      complianceStatus: bus.complianceState?.status ?? null,
    };
  }

  return {
    ...base,
    manufacturer: bus.manufacturer,
    model: bus.model,
    yearOfManufacture: bus.yearOfManufacture,
    fitnessStatus: bus.fitnessStatus,
    registrationStatus: bus.registrationStatus,
    insuranceStatus: bus.insuranceStatus,
    companyId: bus.companyId,
    routeId: bus.routeId,
    driverId: bus.driverId,
    driver: bus.driver ? { id: bus.driver.id, name: bus.driver.user?.fullName ?? null } : null,
    serviceEligible: canStartNormalTrip(bus),
    latestLoc: bus.latestLoc
      ? {
          latitude: Number(bus.latestLoc.latitude),
          longitude: Number(bus.latestLoc.longitude),
          speed: Number(bus.latestLoc.speed),
          heading: Number(bus.latestLoc.heading),
          timestamp: bus.latestLoc.timestamp,
          source: bus.latestLoc.source,
        }
      : null,
    trackingState: bus.latestLoc ? trackingState(bus.latestLoc.timestamp) : "STALE",
    complianceStatus: bus.complianceState?.status ?? null,
  };
}
