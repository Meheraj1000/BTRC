import type {
  BusOperationalStatus,
  FitnessStatus,
  InsuranceStatus,
  Prisma,
  RegistrationStatus,
  RoleCode,
  RouteComplianceStatus,
  VehicleType,
} from "@prisma/client";
import type { Request } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { notifyUser } from "./notification.service.js";
import {
  assertRegistrationNo,
  isVerifiedForService,
  projectBus,
  YEAR_MAX,
  YEAR_MIN,
} from "../utils/busDto.js";
import {
  driverAssignmentBlockReason,
  isDriverEligibleForDuty,
} from "../utils/driverDto.js";
import { hasPermission } from "../utils/permissions.js";
import { ownerCompanyId, pagination } from "../utils/scope.js";
import { assertRouteForBusCreate, assertRouteForBusUpdate } from "./route.service.js";
import { ensureBusQrToken } from "./publicBus.service.js";
import { newQrToken } from "../utils/qrToken.js";

export const busInclude = {
  company: { select: { id: true, name: true, city: true } },
  route: {
    select: {
      id: true,
      name: true,
      code: true,
      startName: true,
      endName: true,
      city: true,
      allowedSpeed: true,
    },
  },
  driver: {
    include: {
      user: { select: { fullName: true } },
    },
  },
  latestLoc: true,
  complianceState: { select: { status: true, deviationM: true } },
} satisfies Prisma.BusInclude;

type BusRecord = Prisma.BusGetPayload<{ include: typeof busInclude }>;

function rolesOf(req: Request): RoleCode[] {
  return req.user?.roles ?? [];
}

function isOwnerOnly(req: Request) {
  const roles = rolesOf(req);
  return roles.includes("TRANSPORT_OWNER") && !roles.includes("SUPER_ADMIN");
}

function isDriverOnly(req: Request) {
  const roles = rolesOf(req);
  return (
    roles.includes("DRIVER") &&
    !roles.includes("SUPER_ADMIN") &&
    !roles.includes("TRANSPORT_OWNER") &&
    !hasPermission(roles, "buses.manage")
  );
}

async function driverIdForUser(userId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true } });
  return driver?.id ?? null;
}

async function assertDriverAssignable(driverId: string, companyId: string, ownerScoped: boolean) {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, deletedAt: null } });
  if (!driver) throw new ApiError("Driver not found", 400);
  if (driver.companyId && driver.companyId !== companyId) {
    throw new ApiError("Driver does not belong to this operator", 400);
  }
  if (ownerScoped && driver.companyId !== companyId) {
    throw new ApiError("You can only assign a driver from your own company", 403);
  }
  if (!isDriverEligibleForDuty(driver)) {
    throw new ApiError(driverAssignmentBlockReason(driver), 409);
  }
}

function parseRegistration(value: string) {
  try {
    return assertRegistrationNo(value);
  } catch {
    throw new ApiError(
      "Invalid registration number. Use 5–32 letters, numbers, or hyphens (e.g. DHAKA-METRO-D-99).",
      422,
    );
  }
}

export async function assertCanViewBus(req: Request, bus: { companyId: string; driverId: string | null }) {
  const ownerCid = await ownerCompanyId(req);
  if (ownerCid && bus.companyId !== ownerCid) {
    throw new ApiError("You cannot access another operator's resources", 403);
  }
  if (isDriverOnly(req)) {
    const driverId = await driverIdForUser(req.user!.id);
    if (!driverId || bus.driverId !== driverId) {
      throw new ApiError("You can only access your assigned vehicle", 403);
    }
  }
}

export async function listBuses(req: Request) {
  const ownerCid = await ownerCompanyId(req);
  const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const sortBy = ["registrationNo", "createdAt", "operationalStatus", "vehicleType"].includes(String(req.query.sortBy))
    ? String(req.query.sortBy)
    : "registrationNo";
  const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";

  const where: Prisma.BusWhereInput = { deletedAt: null };
  if (ownerCid) where.companyId = ownerCid;
  else if (typeof req.query.companyId === "string" && req.query.companyId) {
    where.companyId = req.query.companyId;
  }
  if (isDriverOnly(req)) {
    const driverId = await driverIdForUser(req.user!.id);
    where.driverId = driverId ?? "00000000-0000-0000-0000-000000000000";
  }
  if (q) where.registrationNo = { contains: q, mode: "insensitive" };
  if (typeof req.query.operationalStatus === "string") {
    where.operationalStatus = req.query.operationalStatus as BusOperationalStatus;
  }
  if (typeof req.query.registrationStatus === "string") {
    where.registrationStatus = req.query.registrationStatus as RegistrationStatus;
  }
  if (typeof req.query.fitnessStatus === "string") {
    where.fitnessStatus = req.query.fitnessStatus as FitnessStatus;
  }
  if (typeof req.query.vehicleType === "string") {
    where.vehicleType = req.query.vehicleType as VehicleType;
  }
  if (typeof req.query.complianceStatus === "string" && req.query.complianceStatus) {
    where.complianceState = { status: req.query.complianceStatus as RouteComplianceStatus };
  }
  if (req.query.trackingState === "ONLINE" || req.query.trackingState === "STALE") {
    const staleBefore = new Date(Date.now() - env.GPS_STALE_SECONDS * 1000);
    if (req.query.trackingState === "ONLINE") {
      where.latestLoc = { timestamp: { gte: staleBefore } };
    } else {
      where.OR = [
        { latestLoc: { is: null } },
        { latestLoc: { timestamp: { lt: staleBefore } } },
      ];
    }
  }

  const [rows, total] = await Promise.all([
    prisma.bus.findMany({
      where,
      include: busInclude,
      orderBy: { [sortBy]: sortDir },
      skip,
      take,
    }),
    prisma.bus.count({ where }),
  ]);

  const items = [];
  for (const bus of rows) {
    const qrToken = await ensureBusQrToken(bus.id, bus.qrToken);
    items.push(projectBus({ ...bus, qrToken }, rolesOf(req)));
  }

  return {
    items,
    page,
    pageSize,
    total,
    verificationLabel: "MANUAL / SIMULATED VERIFICATION",
  };
}

export async function getBus(req: Request, id: string) {
  const bus = await prisma.bus.findFirst({
    where: { id, deletedAt: null },
    include: busInclude,
  });
  if (!bus) throw new ApiError("Bus not found", 404);
  await assertCanViewBus(req, bus);
  const qrToken = await ensureBusQrToken(bus.id, bus.qrToken);
  return projectBus({ ...bus, qrToken }, rolesOf(req));
}

export async function createBus(req: Request, body: {
  registrationNo: string;
  vehicleType: VehicleType;
  capacity: number;
  companyId?: string;
  manufacturer?: string;
  model?: string;
  yearOfManufacture?: number | null;
  routeId?: string | null;
  driverId?: string | null;
}) {
  const ownerCid = await ownerCompanyId(req);
  const companyId = ownerCid ?? body.companyId;
  if (!companyId) throw new ApiError("Operator / company is required", 422);

  const company = await prisma.transportCompany.findFirst({ where: { id: companyId, deletedAt: null } });
  if (!company) throw new ApiError("Operator / company not found", 400);

  if (body.routeId) await assertRouteForBusCreate(body.routeId, companyId);
  if (body.driverId) await assertDriverAssignable(body.driverId, companyId, Boolean(ownerCid));

  const registrationNo = parseRegistration(body.registrationNo);
  if (body.yearOfManufacture != null && (body.yearOfManufacture < YEAR_MIN || body.yearOfManufacture > YEAR_MAX)) {
    throw new ApiError("Invalid year of manufacture", 422);
  }

  let created;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      created = await prisma.bus.create({
        data: {
          registrationNo,
          qrToken: newQrToken(),
          vehicleType: body.vehicleType,
          manufacturer: body.manufacturer,
          model: body.model,
          capacity: body.capacity,
          companyId,
          routeId: body.routeId ?? null,
          driverId: body.driverId ?? null,
          yearOfManufacture: body.yearOfManufacture ?? null,
          fitnessStatus: "PENDING",
          registrationStatus: "PENDING",
          insuranceStatus: "NONE",
          operationalStatus: "INACTIVE",
        },
        include: busInclude,
      });
      break;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      // P2002 unique — retry only when qrToken collides; registration conflicts bubble up.
      if (code === "P2002" && attempt < 4) {
        const meta = (err as { meta?: { target?: string[] } }).meta;
        const target = meta?.target ?? [];
        if (target.includes("qrToken") || target.some((t) => String(t).includes("qrToken"))) {
          continue;
        }
      }
      throw err;
    }
  }
  if (!created) throw new ApiError("Unable to allocate QR token for vehicle", 500);

  if (body.driverId) {
    await prisma.driverAssignment.create({ data: { driverId: body.driverId, busId: created.id } });
  }
  if (body.routeId) {
    await prisma.busAssignment.create({ data: { busId: created.id, routeId: body.routeId } });
  }

  // Guarantee token is present (legacy rows / race) and return projected DTO with qrUrl.
  const qrToken = await ensureBusQrToken(created.id, created.qrToken);
  return projectBus({ ...created, qrToken }, rolesOf(req));
}

export async function updateBus(req: Request, id: string, body: Record<string, unknown>) {
  const existing = await prisma.bus.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError("Bus not found", 404);
  await assertCanViewBus(req, existing);

  const ownerCid = await ownerCompanyId(req);
  const ownerScoped = isOwnerOnly(req);

  if (ownerScoped) {
    if ("fitnessStatus" in body || "registrationStatus" in body || "insuranceStatus" in body) {
      throw new ApiError("Owners cannot change verification fields", 403);
    }
    if (typeof body.companyId === "string" && body.companyId !== existing.companyId) {
      throw new ApiError("Owners cannot transfer vehicle ownership", 403);
    }
    if ("gpsDeviceId" in body) {
      throw new ApiError("Owners cannot change GPS device binding", 403);
    }
    if ("registrationNo" in body && body.registrationNo !== existing.registrationNo) {
      throw new ApiError("Owners cannot change the registration number after creation", 403);
    }
  }

  const nextCompanyId = !ownerScoped && typeof body.companyId === "string" ? body.companyId : existing.companyId;
  if (nextCompanyId !== existing.companyId) {
    const company = await prisma.transportCompany.findFirst({ where: { id: nextCompanyId, deletedAt: null } });
    if (!company) throw new ApiError("Operator / company not found", 400);
  }

  const data: Prisma.BusUpdateInput = {};

  if (!ownerScoped && typeof body.registrationNo === "string") {
    data.registrationNo = parseRegistration(body.registrationNo);
  }
  if (typeof body.vehicleType === "string") data.vehicleType = body.vehicleType as VehicleType;
  if (typeof body.manufacturer === "string" || body.manufacturer === null) data.manufacturer = body.manufacturer as string | null;
  if (typeof body.model === "string" || body.model === null) data.model = body.model as string | null;
  if (typeof body.capacity === "number") data.capacity = body.capacity;
  if (typeof body.yearOfManufacture === "number" || body.yearOfManufacture === null) {
    if (typeof body.yearOfManufacture === "number" && (body.yearOfManufacture < YEAR_MIN || body.yearOfManufacture > YEAR_MAX)) {
      throw new ApiError("Invalid year of manufacture", 422);
    }
    data.yearOfManufacture = body.yearOfManufacture as number | null;
  }
  if (nextCompanyId !== existing.companyId) {
    data.company = { connect: { id: nextCompanyId } };
  }

  const nextRouteId = body.routeId === undefined ? existing.routeId : (body.routeId as string | null);
  const nextDriverId = body.driverId === undefined ? existing.driverId : (body.driverId as string | null);
  if (body.routeId !== undefined) {
    if (nextRouteId) await assertRouteForBusUpdate(nextRouteId, existing);
    data.route = nextRouteId ? { connect: { id: nextRouteId } } : { disconnect: true };
  }
  if (body.driverId !== undefined) {
    if (nextDriverId) await assertDriverAssignable(nextDriverId, nextCompanyId, Boolean(ownerCid));
    data.driver = nextDriverId ? { connect: { id: nextDriverId } } : { disconnect: true };
  }

  if (!ownerScoped && typeof body.gpsDeviceId === "string") {
    data.gpsDevice = { connect: { id: body.gpsDeviceId } };
  } else if (!ownerScoped && body.gpsDeviceId === null) {
    data.gpsDevice = { disconnect: true };
  }

  if (typeof body.operationalStatus === "string") {
    const nextStatus = body.operationalStatus as BusOperationalStatus;
    if (ownerScoped && nextStatus === "ACTIVE" && !isVerifiedForService(existing)) {
      throw new ApiError("Vehicle must pass manual / simulated verification before it can be set active", 409);
    }
    data.operationalStatus = nextStatus;
  }

  const updated = await prisma.bus.update({
    where: { id: existing.id },
    data,
    include: busInclude,
  });

  if (nextDriverId && nextDriverId !== existing.driverId) {
    await prisma.driverAssignment.create({ data: { driverId: nextDriverId, busId: updated.id } });
    const driver = await prisma.driver.findUnique({ where: { id: nextDriverId } });
    if (driver) {
      await notifyUser({
        userId: driver.userId,
        type: "DRIVER_ASSIGNMENT",
        title: "Bus assigned",
        body: `You have been assigned to ${updated.registrationNo}`,
        payload: { busId: updated.id },
      });
    }
  }
  if (nextRouteId && nextRouteId !== existing.routeId) {
    await prisma.busAssignment.create({ data: { busId: updated.id, routeId: nextRouteId } });
  }

  if (nextCompanyId !== existing.companyId) {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: "bus.ownership",
        entity: "Bus",
        entityId: existing.id,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
        metadata: { fromCompanyId: existing.companyId, toCompanyId: nextCompanyId },
      },
    });
  }

  return projectBus(updated, rolesOf(req));
}

export async function changeBusStatus(req: Request, id: string, operationalStatus: BusOperationalStatus) {
  const existing = await prisma.bus.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError("Bus not found", 404);
  await assertCanViewBus(req, existing);

  if (isOwnerOnly(req) && operationalStatus === "ACTIVE" && !isVerifiedForService(existing)) {
    throw new ApiError("Vehicle must pass manual / simulated verification before it can be set active", 409);
  }

  const updated = await prisma.bus.update({
    where: { id: existing.id },
    data: { operationalStatus },
    include: busInclude,
  });
  return projectBus(updated, rolesOf(req));
}

export async function verifyBus(req: Request, id: string, body: {
  fitnessStatus?: FitnessStatus;
  registrationStatus?: RegistrationStatus;
  insuranceStatus?: InsuranceStatus;
}) {
  const existing = await prisma.bus.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError("Bus not found", 404);

  const updated = await prisma.bus.update({
    where: { id: existing.id },
    data: {
      fitnessStatus: body.fitnessStatus,
      registrationStatus: body.registrationStatus,
      insuranceStatus: body.insuranceStatus,
    },
    include: busInclude,
  });
  return projectBus(updated, rolesOf(req));
}

export async function archiveBus(req: Request, id: string) {
  const existing = await prisma.bus.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ApiError("Bus not found", 404);
  await assertCanViewBus(req, existing);

  const activeTrip = await prisma.trip.findFirst({
    where: { busId: existing.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (activeTrip) {
    throw new ApiError("End the active trip before archiving this vehicle. Historical GPS and trips are kept.", 409);
  }

  await prisma.bus.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), operationalStatus: "INACTIVE" },
  });
}

export type { BusRecord };
