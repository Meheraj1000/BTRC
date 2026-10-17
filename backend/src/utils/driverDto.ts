import type { RoleCode } from "@prisma/client";

const SOON_MS = 30 * 24 * 60 * 60 * 1000;

export const licenseNumberSchema = {
  normalize(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, "-");
  },
  isValid(value: string) {
    return /^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/.test(value);
  },
};

export function assertLicenseNumber(value: string) {
  const licenseNumber = licenseNumberSchema.normalize(value);
  if (!licenseNumberSchema.isValid(licenseNumber)) {
    throw new Error("INVALID_LICENSE");
  }
  return licenseNumber;
}

export function isBdMobile(value: string) {
  return /^01[3-9]\d{8}$/.test(value.trim());
}

export type LicenseValidity = "VALID" | "EXPIRED" | "EXPIRING_SOON" | "PENDING" | "INVALID" | "MISSING";

export function licenseValidity(driver: {
  licenseStatus: string;
  licenseExpiry?: Date | string | null;
  licenseNumber?: string | null;
}): LicenseValidity {
  if (!driver.licenseNumber) return "MISSING";
  if (driver.licenseStatus === "SUSPENDED") return "INVALID";
  const expiry = driver.licenseExpiry ? new Date(driver.licenseExpiry) : null;
  if (driver.licenseStatus === "EXPIRED" || (expiry && expiry.getTime() < Date.now())) return "EXPIRED";
  if (driver.licenseStatus === "PENDING") return "PENDING";
  if (driver.licenseStatus === "VALID" && expiry && expiry.getTime() < Date.now() + SOON_MS) return "EXPIRING_SOON";
  if (driver.licenseStatus === "VALID") return "VALID";
  return "PENDING";
}

export function isDriverEligibleForDuty(driver: {
  deletedAt?: Date | null;
  status: string;
  licenseStatus: string;
  licenseExpiry?: Date | string | null;
  licenseNumber?: string | null;
  registrationStatus?: string | null;
}) {
  if (driver.deletedAt) return false;
  if (driver.registrationStatus && driver.registrationStatus !== "APPROVED") return false;
  if (driver.status !== "ACTIVE") return false;
  const validity = licenseValidity(driver);
  return validity === "VALID" || validity === "EXPIRING_SOON";
}

export function driverAssignmentBlockReason(driver: {
  deletedAt?: Date | null;
  status: string;
  licenseStatus: string;
  licenseExpiry?: Date | string | null;
  licenseNumber?: string | null;
  registrationStatus?: string | null;
}) {
  if (driver.deletedAt) return "This driver has been archived";
  if (driver.registrationStatus === "PENDING_REVIEW") {
    return "Driver registration is awaiting Super Admin review";
  }
  if (driver.registrationStatus === "REJECTED") {
    return "Driver registration was rejected";
  }
  if (driver.status === "SUSPENDED") return "Suspended drivers cannot be assigned to a vehicle";
  if (driver.status === "INACTIVE") return "Inactive drivers cannot be assigned to a vehicle";
  const validity = licenseValidity(driver);
  if (validity === "EXPIRED") return "Expired license — driver is not eligible for active assignment";
  if (validity === "INVALID") return "License is suspended (manual / simulated verification)";
  if (validity === "PENDING" || validity === "MISSING") {
    return "Driver license is not verified (manual / simulated verification)";
  }
  return "Driver is not eligible for assignment";
}

export function isVehicleEligibleForAssignment(bus: {
  deletedAt?: Date | null;
  operationalStatus: string;
  registrationStatus: string;
}) {
  if (bus.deletedAt) return false;
  if (bus.operationalStatus === "OFFLINE") return false;
  if (bus.registrationStatus === "SUSPENDED") return false;
  return true;
}

export function vehicleAssignmentBlockReason(bus: {
  deletedAt?: Date | null;
  operationalStatus: string;
  registrationStatus: string;
}) {
  if (bus.deletedAt) return "Vehicle has been archived";
  if (bus.operationalStatus === "OFFLINE") return "Offline / retired vehicles cannot receive a driver assignment";
  if (bus.registrationStatus === "SUSPENDED") return "Suspended vehicles cannot receive a driver assignment";
  return "Vehicle is not eligible for assignment";
}

type DriverRow = {
  id: string;
  userId: string;
  companyId: string | null;
  licenseNumber: string;
  licenseStatus: string;
  licenseExpiry: Date | null;
  experienceYears: number;
  status: string;
  registrationStatus?: string | null;
  registrationNote?: string | null;
  violationCount: number;
  performanceScore: unknown;
  createdAt: Date;
  updatedAt: Date;
  user?: { id?: string; fullName?: string; email?: string | null; phone?: string | null } | null;
  company?: { id?: string; name?: string } | null;
  buses?: Array<{ id: string; registrationNo: string; operationalStatus?: string }> | null;
  assignments?: Array<{
    id: string;
    busId: string;
    assignedAt: Date;
    endedAt: Date | null;
    bus?: { registrationNo?: string } | null;
  }> | null;
};

export function projectDriver(driver: DriverRow, roles: RoleCode[]) {
  const validity = licenseValidity(driver);
  const registrationStatus = driver.registrationStatus ?? "APPROVED";
  const base = {
    id: driver.id,
    fullName: driver.user?.fullName ?? null,
    licenseNumber: driver.licenseNumber,
    licenseStatus: driver.licenseStatus,
    licenseExpiry: driver.licenseExpiry,
    licenseValidity: validity,
    status: driver.status,
    registrationStatus,
    registrationNote: driver.registrationNote ?? null,
    experienceYears: driver.experienceYears,
    verificationLabel: "MANUAL / SIMULATED VERIFICATION",
    company: driver.company
      ? { id: driver.company.id, name: driver.company.name }
      : driver.companyId
        ? { id: driver.companyId, name: null }
        : null,
    buses: (driver.buses ?? []).map((b) => ({
      id: b.id,
      registrationNo: b.registrationNo,
      operationalStatus: b.operationalStatus,
    })),
    dutyEligible: isDriverEligibleForDuty(driver),
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };

  if (roles.includes("POLICE") && !roles.includes("SUPER_ADMIN")) {
    return base;
  }

  return {
    ...base,
    userId: driver.userId,
    companyId: driver.companyId,
    email: driver.user?.email ?? null,
    phone: driver.user?.phone ?? null,
    violationCount: driver.violationCount,
    performanceScore: Number(driver.performanceScore),
    assignments: (driver.assignments ?? []).map((a) => ({
      id: a.id,
      busId: a.busId,
      registrationNo: a.bus?.registrationNo ?? null,
      assignedAt: a.assignedAt,
      endedAt: a.endedAt,
    })),
  };
}
