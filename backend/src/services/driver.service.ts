import type { DriverRegistrationStatus, LicenseStatus, Prisma, RoleCode, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { notifyUser } from "./notification.service.js";
import {
  assertLicenseNumber,
  driverAssignmentBlockReason,
  isBdMobile,
  isDriverEligibleForDuty,
  isVehicleEligibleForAssignment,
  licenseValidity,
  projectDriver,
  vehicleAssignmentBlockReason,
} from "../utils/driverDto.js";
import { ownerCompanyId, pagination } from "../utils/scope.js";

export const driverInclude = {
  user: { select: { id: true, fullName: true, email: true, phone: true } },
  company: { select: { id: true, name: true } },
  buses: { select: { id: true, registrationNo: true, operationalStatus: true } },
  assignments: {
    orderBy: { assignedAt: "desc" as const },
    take: 20,
    include: { bus: { select: { registrationNo: true } } },
  },
} satisfies Prisma.DriverInclude;

function rolesOf(req: Request): RoleCode[] {
  return req.user?.roles ?? [];
}

function isOwnerOnly(req: Request) {
  const roles = rolesOf(req);
  return roles.includes("TRANSPORT_OWNER") && !roles.includes("SUPER_ADMIN");
}

function parseLicense(value: string) {
  try {
    return assertLicenseNumber(value);
  } catch {
    throw new ApiError("Invalid driving license number", 422);
  }
}

function parsePhone(value?: string | null) {
  if (!value) return undefined;
  const phone = value.trim();
  if (!isBdMobile(phone)) throw new ApiError("Invalid Bangladesh mobile number", 422);
  return phone;
}

export async function assertCanViewDriver(req: Request, driver: { companyId: string | null }) {
  const ownerCid = await ownerCompanyId(req);
  if (ownerCid && driver.companyId !== ownerCid) {
    throw new ApiError("You cannot access another operator's resources", 403);
  }
}

export async function listDrivers(req: Request) {
  const ownerCid = await ownerCompanyId(req);
  const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const where: Prisma.DriverWhereInput = { deletedAt: null };
  if (ownerCid) where.companyId = ownerCid;
  else if (typeof req.query.companyId === "string" && req.query.companyId) {
    where.companyId = req.query.companyId;
  }
  if (typeof req.query.licenseStatus === "string") {
    where.licenseStatus = req.query.licenseStatus as LicenseStatus;
  }
  if (typeof req.query.status === "string") {
    where.status = req.query.status as UserStatus;
  }
  if (typeof req.query.registrationStatus === "string" && req.query.registrationStatus) {
    where.registrationStatus = req.query.registrationStatus as DriverRegistrationStatus;
  }
  if (q) {
    where.OR = [
      { licenseNumber: { contains: q, mode: "insensitive" } },
      { user: { fullName: { contains: q, mode: "insensitive" } } },
      { user: { phone: { contains: q } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const validity = typeof req.query.licenseValidity === "string" ? req.query.licenseValidity : "";
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const extra: Prisma.DriverWhereInput[] = [];
  if (validity === "EXPIRED") {
    extra.push({ OR: [{ licenseStatus: "EXPIRED" }, { licenseExpiry: { lt: now } }] });
  } else if (validity === "EXPIRING_SOON") {
    extra.push({ licenseStatus: "VALID", licenseExpiry: { gte: now, lt: soon } });
  } else if (validity === "VALID") {
    extra.push({ licenseStatus: "VALID", OR: [{ licenseExpiry: null }, { licenseExpiry: { gte: soon } }] });
  } else if (validity === "PENDING") {
    extra.push({ licenseStatus: "PENDING" });
  } else if (validity === "INVALID") {
    extra.push({ licenseStatus: "SUSPENDED" });
  }
  if (extra.length) where.AND = extra;

  const [rows, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      include: driverInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.driver.count({ where }),
  ]);

  return {
    items: rows.map((d) => projectDriver(d, rolesOf(req))),
    page,
    pageSize,
    total,
    verificationLabel: "MANUAL / SIMULATED VERIFICATION",
  };
}

export async function getDriver(req: Request, id: string) {
  const driver = await prisma.driver.findFirst({
    where: { id, deletedAt: null },
    include: driverInclude,
  });
  if (!driver) throw new ApiError("Driver not found", 404);
  await assertCanViewDriver(req, driver);
  return projectDriver(driver, rolesOf(req));
}

export async function createDriver(req: Request, body: {
  userId?: string;
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  licenseNumber: string;
  licenseExpiry?: string | null;
  experienceYears?: number;
  companyId?: string;
}) {
  const ownerCid = await ownerCompanyId(req);
  const companyId = ownerCid ?? body.companyId;
  if (!companyId) throw new ApiError("Operator / company is required", 422);
  const company = await prisma.transportCompany.findFirst({ where: { id: companyId, deletedAt: null } });
  if (!company) throw new ApiError("Operator / company not found", 400);

  const licenseNumber = parseLicense(body.licenseNumber);
  const phone = parsePhone(body.phone);
  const licenseExpiry = body.licenseExpiry ? new Date(body.licenseExpiry) : null;
  if (licenseExpiry && Number.isNaN(licenseExpiry.getTime())) {
    throw new ApiError("Invalid license expiry date", 422);
  }

  let userId = body.userId;
  if (userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { driver: true, userRoles: { include: { role: true } } },
    });
    if (!user) throw new ApiError("User not found", 400);
    if (user.driver) throw new ApiError("This user already has a driver profile", 409);
    const privileged = user.userRoles.some((r) =>
      ["SUPER_ADMIN", "GOVERNMENT", "BRTA", "POLICE", "TRANSPORT_OWNER"].includes(r.role.code),
    );
    if (privileged) throw new ApiError("That account cannot be linked as a driver", 400);
    const driverRole = await prisma.role.findUnique({ where: { code: "DRIVER" } });
    if (driverRole && !user.userRoles.some((r) => r.role.code === "DRIVER")) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: driverRole.id } });
    }
  } else {
    if (!body.email || !body.password || !body.fullName) {
      throw new ApiError("fullName, email, and password are required to register a driver", 422);
    }
    const exists = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (exists) throw new ApiError("An account with this email already exists", 409);
    const driverRole = await prisma.role.findUnique({ where: { code: "DRIVER" } });
    if (!driverRole) throw new ApiError("Driver role is not configured", 500);
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        phone,
        fullName: body.fullName.trim(),
        passwordHash: await bcrypt.hash(body.password, 12),
        userRoles: { create: { roleId: driverRole.id } },
      },
    });
    userId = user.id;
  }

  const created = await prisma.driver.create({
    data: {
      userId: userId!,
      companyId,
      licenseNumber,
      licenseExpiry,
      experienceYears: body.experienceYears ?? 0,
      licenseStatus: "PENDING",
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      registrationNote: null,
    },
    include: driverInclude,
  });
  // Admin/owner-created accounts are usable immediately.
  await prisma.user.update({
    where: { id: userId! },
    data: { status: "ACTIVE" },
  });
  return projectDriver(created, rolesOf(req));
}

function assertSuperAdmin(req: Request) {
  if (!rolesOf(req).includes("SUPER_ADMIN")) {
    throw new ApiError("Only a Super Admin can review driver registrations", 403);
  }
}

export async function reviewDriverRegistration(
  req: Request,
  id: string,
  decision: "APPROVE" | "REJECT",
  options?: { companyId?: string | null; note?: string | null },
) {
  assertSuperAdmin(req);
  const existing = await prisma.driver.findFirst({
    where: { id, deletedAt: null },
    include: { user: true },
  });
  if (!existing) throw new ApiError("Driver not found", 404);
  if (existing.registrationStatus !== "PENDING_REVIEW") {
    throw new ApiError("This driver registration is not awaiting review", 409);
  }

  if (decision === "REJECT") {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: { status: "INACTIVE" },
      });
      return tx.driver.update({
        where: { id: existing.id },
        data: {
          status: "INACTIVE",
          registrationStatus: "REJECTED",
          registrationNote: options?.note?.trim() || "Rejected by Super Admin — details were incorrect or incomplete.",
        },
        include: driverInclude,
      });
    });
    await notifyUser({
      userId: existing.userId,
      type: "SYSTEM_ANNOUNCEMENT",
      title: "Driver registration rejected",
      body: options?.note?.trim()
        || "Your driver registration was rejected. Contact the Super Admin or submit a new application with correct details.",
      payload: { driverId: existing.id, registrationStatus: "REJECTED" },
    });
    return projectDriver(updated, rolesOf(req));
  }

  let companyId = existing.companyId;
  if (options?.companyId) {
    const company = await prisma.transportCompany.findFirst({
      where: { id: options.companyId, deletedAt: null },
    });
    if (!company) throw new ApiError("Operator / company not found", 400);
    companyId = company.id;
  }
  if (!companyId) {
    throw new ApiError("Assign an operator / company before accepting this registration", 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { status: "ACTIVE" },
    });
    return tx.driver.update({
      where: { id: existing.id },
      data: {
        companyId,
        status: "ACTIVE",
        registrationStatus: "APPROVED",
        registrationNote: options?.note?.trim() || "Accepted by Super Admin after review.",
      },
      include: driverInclude,
    });
  });

  await notifyUser({
    userId: existing.userId,
    type: "SYSTEM_ANNOUNCEMENT",
    title: "Driver registration accepted",
    body: "Your driver registration was accepted. You can now sign in. License verification may still be pending (manual / simulated).",
    payload: { driverId: existing.id, registrationStatus: "APPROVED" },
  });

  return projectDriver(updated, rolesOf(req));
}

export async function updateDriver(req: Request, id: string, body: Record<string, unknown>) {
  const existing = await prisma.driver.findFirst({
    where: { id, deletedAt: null },
    include: { user: true },
  });
  if (!existing) throw new ApiError("Driver not found", 404);
  await assertCanViewDriver(req, existing);
  const ownerScoped = isOwnerOnly(req);

  if (ownerScoped) {
    if ("licenseStatus" in body || "nidReference" in body || "performanceScore" in body || "violationCount" in body) {
      throw new ApiError("Owners cannot change verification or privileged driver fields", 403);
    }
    if (typeof body.companyId === "string" && body.companyId !== existing.companyId) {
      throw new ApiError("Owners cannot transfer driver ownership", 403);
    }
    if ("userId" in body && body.userId !== existing.userId) {
      throw new ApiError("Owners cannot rebind a driver to another user account", 403);
    }
    if (typeof body.status === "string" && body.status === "SUSPENDED") {
      throw new ApiError("Owners cannot suspend a driver", 403);
    }
  }

  const data: Prisma.DriverUpdateInput = {};
  if (typeof body.licenseNumber === "string") data.licenseNumber = parseLicense(body.licenseNumber);
  if (body.licenseExpiry === null) data.licenseExpiry = null;
  if (typeof body.licenseExpiry === "string") {
    const expiry = new Date(body.licenseExpiry);
    if (Number.isNaN(expiry.getTime())) throw new ApiError("Invalid license expiry date", 422);
    data.licenseExpiry = expiry;
  }
  if (typeof body.experienceYears === "number") data.experienceYears = body.experienceYears;
  if (!ownerScoped && typeof body.companyId === "string" && body.companyId !== existing.companyId) {
    const company = await prisma.transportCompany.findFirst({ where: { id: body.companyId, deletedAt: null } });
    if (!company) throw new ApiError("Operator / company not found", 400);
    data.company = { connect: { id: body.companyId } };
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: "driver.ownership",
        entity: "Driver",
        entityId: existing.id,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
        metadata: { fromCompanyId: existing.companyId, toCompanyId: body.companyId },
      },
    });
  }
  if (!ownerScoped && typeof body.status === "string") {
    data.status = body.status as UserStatus;
  } else if (ownerScoped && (body.status === "ACTIVE" || body.status === "INACTIVE")) {
    data.status = body.status;
  }

  const userData: { fullName?: string; phone?: string | null } = {};
  if (typeof body.fullName === "string" && body.fullName.trim().length >= 2) userData.fullName = body.fullName.trim();
  if ("phone" in body) userData.phone = parsePhone(typeof body.phone === "string" ? body.phone : undefined) ?? null;
  if (Object.keys(userData).length) {
    await prisma.user.update({ where: { id: existing.userId }, data: userData });
  }

  const updated = await prisma.driver.update({
    where: { id: existing.id },
    data,
    include: driverInclude,
  });
  return projectDriver(updated, rolesOf(req));
}

export async function changeDriverStatus(req: Request, id: string, status: UserStatus) {
  const existing = await prisma.driver.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError("Driver not found", 404);
  await assertCanViewDriver(req, existing);
  if (isOwnerOnly(req) && status === "SUSPENDED") {
    throw new ApiError("Owners cannot suspend a driver", 403);
  }
  const updated = await prisma.driver.update({
    where: { id: existing.id },
    data: { status },
    include: driverInclude,
  });
  return projectDriver(updated, rolesOf(req));
}

export async function verifyDriver(req: Request, id: string, licenseStatus: LicenseStatus) {
  const existing = await prisma.driver.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError("Driver not found", 404);
  const updated = await prisma.driver.update({
    where: { id: existing.id },
    data: { licenseStatus },
    include: driverInclude,
  });
  return projectDriver(updated, rolesOf(req));
}

export async function assignDriver(req: Request, id: string, busId: string | null) {
  const driver = await prisma.driver.findFirst({ where: { id, deletedAt: null } });
  if (!driver) throw new ApiError("Driver not found", 404);
  await assertCanViewDriver(req, driver);

  if (busId === null) {
    const current = await prisma.bus.findMany({ where: { driverId: driver.id, deletedAt: null } });
    await prisma.$transaction([
      prisma.driverAssignment.updateMany({
        where: { driverId: driver.id, endedAt: null },
        data: { endedAt: new Date() },
      }),
      ...current.map((bus) => prisma.bus.update({ where: { id: bus.id }, data: { driverId: null } })),
    ]);
    const updated = await prisma.driver.findFirst({ where: { id: driver.id }, include: driverInclude });
    return projectDriver(updated!, rolesOf(req));
  }

  if (!isDriverEligibleForDuty(driver)) {
    throw new ApiError(driverAssignmentBlockReason(driver), 409);
  }

  const bus = await prisma.bus.findFirst({ where: { id: busId } });
  if (!bus || bus.deletedAt) throw new ApiError("Vehicle not found", 404);
  await assertCanViewDriver(req, { companyId: bus.companyId });
  if (driver.companyId && driver.companyId !== bus.companyId) {
    throw new ApiError("Driver and vehicle must belong to the same operator", 403);
  }
  if (!isVehicleEligibleForAssignment(bus)) {
    throw new ApiError(vehicleAssignmentBlockReason(bus), 409);
  }

  await prisma.$transaction([
    prisma.driverAssignment.updateMany({
      where: { busId: bus.id, endedAt: null },
      data: { endedAt: new Date() },
    }),
    prisma.driverAssignment.create({
      data: { driverId: driver.id, busId: bus.id },
    }),
    prisma.bus.update({ where: { id: bus.id }, data: { driverId: driver.id } }),
  ]);

  await notifyUser({
    userId: driver.userId,
    type: "DRIVER_ASSIGNMENT",
    title: "Bus assigned",
    body: `You have been assigned to ${bus.registrationNo}`,
    payload: { busId: bus.id },
  });

  const updated = await prisma.driver.findFirst({ where: { id: driver.id }, include: driverInclude });
  return projectDriver(updated!, rolesOf(req));
}

export async function archiveDriver(req: Request, id: string) {
  const existing = await prisma.driver.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError("Driver not found", 404);
  await assertCanViewDriver(req, existing);
  const activeTrip = await prisma.trip.findFirst({
    where: { driverId: existing.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (activeTrip) {
    throw new ApiError("End the active trip before archiving this driver. Historical trips and GPS are kept.", 409);
  }
  await prisma.$transaction([
    prisma.driverAssignment.updateMany({
      where: { driverId: existing.id, endedAt: null },
      data: { endedAt: new Date() },
    }),
    prisma.bus.updateMany({ where: { driverId: existing.id }, data: { driverId: null } }),
    prisma.driver.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    }),
  ]);
}
