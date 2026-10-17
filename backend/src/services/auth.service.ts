import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { logger } from "../config/logger.js";
import type { RoleCode } from "@prisma/client";
import { assertLicenseNumber, isBdMobile } from "../utils/driverDto.js";
import { notifyRoles } from "./notification.service.js";

const SALT = 12;

function publicUser(user: {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  status: string;
  lastLoginAt: Date | null;
  userRoles: { role: { code: RoleCode; name: string } }[];
}) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    roles: user.userRoles.map((r) => r.role.code),
    roleNames: user.userRoles.map((r) => r.role.name),
  };
}

const userInclude = { userRoles: { include: { role: true } } } as const;

export async function registerPassenger(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}) {
  const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (exists) throw new ApiError("An account with this email already exists", 409);

  const passengerRole = await prisma.role.findUnique({ where: { code: "PASSENGER" } });
  if (!passengerRole) throw new ApiError("Passenger role is not configured", 500);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: await bcrypt.hash(input.password, SALT),
      fullName: input.fullName,
      userRoles: { create: { roleId: passengerRole.id } },
      passenger: { create: {} },
    },
    include: userInclude,
  });

  logger.info("auth_register", { userId: user.id, email: user.email });
  return issueTokens(user);
}

export async function registerDriver(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry?: string | null;
  experienceYears?: number;
  companyId?: string | null;
}) {
  const email = input.email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ApiError("An account with this email already exists", 409);

  let licenseNumber: string;
  try {
    licenseNumber = assertLicenseNumber(input.licenseNumber);
  } catch {
    throw new ApiError("Invalid driving license number", 422);
  }
  const licenseTaken = await prisma.driver.findFirst({
    where: { licenseNumber, deletedAt: null },
    select: { id: true },
  });
  if (licenseTaken) throw new ApiError("A driver with this license number is already registered", 409);

  const phone = input.phone.trim();
  if (!isBdMobile(phone)) throw new ApiError("Invalid Bangladesh mobile number (use 01XXXXXXXXX)", 422);
  const phoneTaken = await prisma.user.findFirst({ where: { phone, deletedAt: null }, select: { id: true } });
  if (phoneTaken) throw new ApiError("An account with this phone number already exists", 409);

  let companyId: string | null = null;
  if (input.companyId) {
    const company = await prisma.transportCompany.findFirst({
      where: { id: input.companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!company) throw new ApiError("Selected operator / company was not found", 400);
    companyId = company.id;
  }

  const licenseExpiry = input.licenseExpiry ? new Date(input.licenseExpiry) : null;
  if (licenseExpiry && Number.isNaN(licenseExpiry.getTime())) {
    throw new ApiError("Invalid license expiry date", 422);
  }

  const driverRole = await prisma.role.findUnique({ where: { code: "DRIVER" } });
  if (!driverRole) throw new ApiError("Driver role is not configured", 500);

  const user = await prisma.user.create({
    data: {
      email,
      phone,
      fullName: input.fullName.trim(),
      passwordHash: await bcrypt.hash(input.password, SALT),
      status: "INACTIVE",
      userRoles: { create: { roleId: driverRole.id } },
      driver: {
        create: {
          companyId,
          licenseNumber,
          licenseExpiry,
          experienceYears: input.experienceYears ?? 0,
          licenseStatus: "PENDING",
          status: "INACTIVE",
          registrationStatus: "PENDING_REVIEW",
        },
      },
    },
    include: {
      ...userInclude,
      driver: { select: { id: true, licenseNumber: true, registrationStatus: true } },
    },
  });

  await notifyRoles(["SUPER_ADMIN"], {
    type: "SYSTEM_ANNOUNCEMENT",
    title: "Driver registration pending review",
    body: `${user.fullName} (${user.email}) submitted a driver registration for license ${licenseNumber}. Review and accept if the details are correct.`,
    payload: { driverId: user.driver?.id, userId: user.id, licenseNumber },
  });

  logger.info("auth_register_driver", { userId: user.id, email: user.email, driverId: user.driver?.id });
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    registrationStatus: "PENDING_REVIEW" as const,
    message: "Registration submitted. A Super Admin must review and accept your application before you can sign in.",
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      ...userInclude,
      driver: { select: { registrationStatus: true } },
    },
  });
  if (!user || user.deletedAt) {
    logger.info("auth_login_failed");
    throw new ApiError("Invalid email or password", 401);
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    logger.info("auth_login_failed");
    throw new ApiError("Invalid email or password", 401);
  }

  if (user.status !== "ACTIVE") {
    if (user.driver?.registrationStatus === "PENDING_REVIEW") {
      throw new ApiError(
        "Your driver registration is awaiting Super Admin review. You cannot sign in until it is accepted.",
        403,
      );
    }
    if (user.driver?.registrationStatus === "REJECTED") {
      throw new ApiError(
        "Your driver registration was rejected. Contact the Super Admin or submit a new application with correct details.",
        403,
      );
    }
    throw new ApiError("This account is not active", 403);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  logger.info("auth_login", { userId: user.id });
  return issueTokens(user);
}

export async function refresh(refreshToken: string) {
  let sub: string;
  try {
    sub = verifyRefreshToken(refreshToken).sub;
  } catch {
    throw new ApiError("Invalid refresh token", 401);
  }
  const hash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { userId: sub, tokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!stored) throw new ApiError("Refresh token revoked or expired", 401);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: sub }, include: userInclude });
  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    throw new ApiError("Invalid refresh token", 401);
  }
  return issueTokens(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    throw new ApiError("Authentication required", 401);
  }
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) throw new ApiError("Current password is incorrect", 401);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, SALT) },
  });
  await logout(userId);
  logger.info("auth_password_changed", { userId });
  return issueTokens(user);
}

export async function logout(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  logger.info("auth_logout", { userId });
}

export async function updateMe(userId: string, input: {
  fullName?: string;
  phone?: string | null;
  emergencyContact?: string | null;
  emergencyName?: string | null;
  preferredLanguage?: string;
}) {
  const userData: { fullName?: string; phone?: string | null } = {};
  if (typeof input.fullName === "string" && input.fullName.trim().length >= 2) {
    userData.fullName = input.fullName.trim();
  }
  if (input.phone !== undefined) userData.phone = input.phone;
  if (Object.keys(userData).length) {
    await prisma.user.update({ where: { id: userId }, data: userData });
  }
  const passengerData: {
    emergencyContact?: string | null;
    emergencyName?: string | null;
    preferredLanguage?: string;
  } = {};
  if (input.emergencyContact !== undefined) passengerData.emergencyContact = input.emergencyContact;
  if (input.emergencyName !== undefined) passengerData.emergencyName = input.emergencyName;
  if (typeof input.preferredLanguage === "string" && input.preferredLanguage.trim()) {
    passengerData.preferredLanguage = input.preferredLanguage.trim().slice(0, 8);
  }
  if (Object.keys(passengerData).length) {
    await prisma.passenger.updateMany({
      where: { userId, deletedAt: null },
      data: passengerData,
    });
  }
  return me(userId);
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      ...userInclude,
      passenger: true,
      driver: { include: { company: true } },
      ownedCompany: true,
    },
  });
  if (!user) throw new ApiError("User not found", 404);
  return {
    ...publicUser(user),
    passenger: user.passenger,
    driver: user.driver
      ? {
          id: user.driver.id,
          licenseNumber: user.driver.licenseNumber,
          licenseStatus: user.driver.licenseStatus,
          licenseExpiry: user.driver.licenseExpiry,
          experienceYears: user.driver.experienceYears,
          performanceScore: user.driver.performanceScore,
          violationCount: user.driver.violationCount,
          company: user.driver.company,
        }
      : null,
    company: user.ownedCompany,
  };
}

async function issueTokens(user: {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  status: string;
  lastLoginAt: Date | null;
  userRoles: { role: { code: RoleCode; name: string } }[];
}) {
  const roles = user.userRoles.map((r) => r.role.code);
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.fullName,
    roles,
  });
  const refreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt },
  });
  return { user: publicUser(user), accessToken, refreshToken };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
