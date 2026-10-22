import {
  BusOperationalStatus,
  FitnessStatus,
  InsuranceStatus,
  LicenseStatus,
  RegistrationStatus,
  UserStatus,
  VehicleType,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { auditAction } from "../middlewares/audit.js";
import { authRequired } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import {
  archiveBus,
  changeBusStatus,
  createBus,
  getBus,
  listBuses,
  updateBus,
  verifyBus,
} from "../services/bus.service.js";
import {
  archiveDriver,
  assignDriver,
  changeDriverStatus,
  createDriver,
  reviewDriverRegistration,
  getDriver,
  listDrivers,
  updateDriver,
  verifyDriver,
} from "../services/driver.service.js";
import { YEAR_MAX, YEAR_MIN } from "../utils/busDto.js";
import { param } from "../utils/http.js";
import { connectGpsDevice, disconnectGpsDevice, listGpsDevices, registerGpsDevice } from "../services/gpsDevice.service.js";
import { passwordSchema } from "../utils/password.js";
import { ownerCompanyId } from "../utils/scope.js";

const router = Router();
router.use(authRequired);

// ---- Companies ----
router.get("/companies", requirePermission("companies.read"), async (req, res, next) => {
  try {
    const companyId = await ownerCompanyId(req);
    const items = await prisma.transportCompany.findMany({
      where: { deletedAt: null, id: companyId },
      include: { _count: { select: { buses: true, drivers: true } } },
      orderBy: { name: "asc" },
    });
    return ok(res, items);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/companies",
  requirePermission("companies.manage"),
  validate(z.object({
    name: z.string().min(2),
    registration: z.string().min(3),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    ownerUserId: z.string().uuid().optional(),
  })),
  auditAction("company.create", "TransportCompany"),
  async (req, res, next) => {
    try {
      const company = await prisma.transportCompany.create({ data: req.body });
      return ok(res, company, "Company created", 201);
    } catch (err) {
      next(err);
    }
  },
);

router.put("/companies/:id", requirePermission("companies.manage"), auditAction("company.update", "TransportCompany"), async (req, res, next) => {
  try {
    const company = await prisma.transportCompany.update({ where: { id: param(req, "id") }, data: req.body });
    return ok(res, company, "Company updated");
  } catch (err) {
    next(err);
  }
});

// ---- Buses ----
const busListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().max(40).optional(),
  operationalStatus: z.nativeEnum(BusOperationalStatus).optional(),
  registrationStatus: z.nativeEnum(RegistrationStatus).optional(),
  fitnessStatus: z.nativeEnum(FitnessStatus).optional(),
  vehicleType: z.nativeEnum(VehicleType).optional(),
  companyId: z.string().uuid().optional(),
  sortBy: z.enum(["registrationNo", "createdAt", "operationalStatus", "vehicleType"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

/** Treat blank / whitespace optional strings as omitted so empty form fields do not 422. */
const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).max(80).optional(),
);
const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional(),
);
const nullableUuid = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().uuid().nullable().optional(),
);
const optionalYear = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}, z.number().int().min(YEAR_MIN).max(YEAR_MAX).optional().nullable());

const busCreateSchema = z.object({
  registrationNo: z.string().trim().min(5).max(32),
  vehicleType: z.nativeEnum(VehicleType),
  manufacturer: optionalText,
  model: optionalText,
  capacity: z.coerce.number().int().min(8).max(80),
  companyId: optionalUuid,
  routeId: nullableUuid,
  driverId: nullableUuid,
  yearOfManufacture: optionalYear,
});

const busUpdateSchema = z.object({
  registrationNo: z.string().trim().min(5).max(32).optional(),
  vehicleType: z.nativeEnum(VehicleType).optional(),
  manufacturer: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().min(1).max(80).optional().nullable(),
  ),
  model: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().min(1).max(80).optional().nullable(),
  ),
  capacity: z.coerce.number().int().min(8).max(80).optional(),
  companyId: optionalUuid,
  routeId: nullableUuid,
  driverId: nullableUuid,
  gpsDeviceId: nullableUuid,
  operationalStatus: z.nativeEnum(BusOperationalStatus).optional(),
  yearOfManufacture: optionalYear,
  fitnessStatus: z.nativeEnum(FitnessStatus).optional(),
  registrationStatus: z.nativeEnum(RegistrationStatus).optional(),
  insuranceStatus: z.nativeEnum(InsuranceStatus).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });

const busStatusSchema = z.object({
  operationalStatus: z.nativeEnum(BusOperationalStatus),
});

const busVerifySchema = z.object({
  fitnessStatus: z.nativeEnum(FitnessStatus).optional(),
  registrationStatus: z.nativeEnum(RegistrationStatus).optional(),
  insuranceStatus: z.nativeEnum(InsuranceStatus).optional(),
}).refine((value) => Object.values(value).some((v) => v !== undefined), {
  message: "At least one verification field is required",
});

router.get("/buses", requirePermission("buses.read"), validate(busListQuery, "query"), async (req, res, next) => {
  try {
    return ok(res, await listBuses(req));
  } catch (err) {
    next(err);
  }
});

router.post("/buses", requirePermission("buses.manage"), validate(busCreateSchema), auditAction("bus.create", "Bus"), async (req, res, next) => {
  try {
    const bus = await createBus(req, req.body);
    res.locals.entityId = bus.id;
    return ok(res, bus, "Bus created", 201);
  } catch (err) {
    next(err);
  }
});

router.get("/buses/:id", requirePermission("buses.read"), async (req, res, next) => {
  try {
    return ok(res, await getBus(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.put("/buses/:id", requirePermission("buses.manage"), validate(busUpdateSchema), auditAction("bus.update", "Bus"), async (req, res, next) => {
  try {
    return ok(res, await updateBus(req, param(req, "id"), req.body), "Bus updated");
  } catch (err) {
    next(err);
  }
});

router.patch("/buses/:id/status", requirePermission("buses.manage"), validate(busStatusSchema), auditAction("bus.status", "Bus"), async (req, res, next) => {
  try {
    return ok(res, await changeBusStatus(req, param(req, "id"), req.body.operationalStatus), "Vehicle status updated");
  } catch (err) {
    next(err);
  }
});

router.patch("/buses/:id/verification", requirePermission("buses.verify"), validate(busVerifySchema), auditAction("bus.verify", "Bus"), async (req, res, next) => {
  try {
    return ok(res, await verifyBus(req, param(req, "id"), req.body), "Manual / simulated verification updated");
  } catch (err) {
    next(err);
  }
});

router.delete("/buses/:id", requirePermission("buses.manage"), auditAction("bus.delete", "Bus"), async (req, res, next) => {
  try {
    await archiveBus(req, param(req, "id"));
    return ok(res, null, "Bus archived. Historical trips and GPS records are retained.");
  } catch (err) {
    next(err);
  }
});

// ---- Drivers ----
const driverListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().max(80).optional(),
  licenseStatus: z.nativeEnum(LicenseStatus).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  companyId: z.string().uuid().optional(),
  licenseValidity: z.enum(["VALID", "EXPIRED", "EXPIRING_SOON", "PENDING", "INVALID"]).optional(),
  registrationStatus: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
});

const driverCreateSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  password: passwordSchema.optional(),
  fullName: z.string().min(2).max(80).optional(),
  phone: z.string().optional(),
  licenseNumber: z.string().min(4).max(32),
  licenseExpiry: z.string().optional().nullable(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  companyId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.userId) || Boolean(value.email && value.password && value.fullName), {
  message: "Provide an existing userId or fullName, email, and password",
});

const driverUpdateSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  phone: z.string().optional().nullable(),
  licenseNumber: z.string().min(4).max(32).optional(),
  licenseExpiry: z.string().optional().nullable(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  companyId: z.string().uuid().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  licenseStatus: z.nativeEnum(LicenseStatus).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });

router.get("/drivers", requirePermission("drivers.read"), validate(driverListQuery, "query"), async (req, res, next) => {
  try {
    return ok(res, await listDrivers(req));
  } catch (err) {
    next(err);
  }
});

router.post("/drivers", requirePermission("drivers.manage"), validate(driverCreateSchema), auditAction("driver.create", "Driver"), async (req, res, next) => {
  try {
    const driver = await createDriver(req, req.body);
    res.locals.entityId = driver.id;
    return ok(res, driver, "Driver created", 201);
  } catch (err) {
    next(err);
  }
});

router.get("/drivers/:id", requirePermission("drivers.read"), async (req, res, next) => {
  try {
    return ok(res, await getDriver(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.put("/drivers/:id", requirePermission("drivers.manage"), validate(driverUpdateSchema), auditAction("driver.update", "Driver"), async (req, res, next) => {
  try {
    return ok(res, await updateDriver(req, param(req, "id"), req.body), "Driver updated");
  } catch (err) {
    next(err);
  }
});

router.patch("/drivers/:id/status", requirePermission("drivers.manage"), validate(z.object({
  status: z.nativeEnum(UserStatus),
})), auditAction("driver.status", "Driver"), async (req, res, next) => {
  try {
    return ok(res, await changeDriverStatus(req, param(req, "id"), req.body.status), "Driver status updated");
  } catch (err) {
    next(err);
  }
});

router.patch("/drivers/:id/verification", requirePermission("drivers.verify"), validate(z.object({
  licenseStatus: z.nativeEnum(LicenseStatus),
})), auditAction("driver.verify", "Driver"), async (req, res, next) => {
  try {
    return ok(res, await verifyDriver(req, param(req, "id"), req.body.licenseStatus), "Manual / simulated verification updated");
  } catch (err) {
    next(err);
  }
});

router.post(
  "/drivers/:id/registration-review",
  requirePermission("drivers.manage"),
  validate(
    z.object({
      decision: z.enum(["APPROVE", "REJECT"]),
      companyId: z.string().uuid().optional().nullable(),
      note: z.string().max(500).optional().nullable(),
    }),
  ),
  auditAction("driver.registration_review", "Driver"),
  async (req, res, next) => {
    try {
      const driver = await reviewDriverRegistration(req, param(req, "id"), req.body.decision, {
        companyId: req.body.companyId,
        note: req.body.note,
      });
      res.locals.entityId = driver.id;
      return ok(
        res,
        driver,
        req.body.decision === "APPROVE" ? "Driver registration accepted" : "Driver registration rejected",
      );
    } catch (err) {
      next(err);
    }
  },
);

router.patch("/drivers/:id/assignment", requirePermission("drivers.manage"), validate(z.object({
  busId: z.string().uuid().nullable(),
})), auditAction("driver.assign", "Driver"), async (req, res, next) => {
  try {
    return ok(res, await assignDriver(req, param(req, "id"), req.body.busId), req.body.busId ? "Driver assigned" : "Driver unassigned");
  } catch (err) {
    next(err);
  }
});

router.delete("/drivers/:id", requirePermission("drivers.manage"), auditAction("driver.delete", "Driver"), async (req, res, next) => {
  try {
    await archiveDriver(req, param(req, "id"));
    return ok(res, null, "Driver archived. Historical trips and GPS records are retained.");
  } catch (err) {
    next(err);
  }
});

// ---- GPS devices ----
router.get("/gps-devices", requirePermission("gps.manage"), async (_req, res, next) => {
  try {
    return ok(res, await listGpsDevices());
  } catch (err) {
    next(err);
  }
});

router.post(
  "/gps-devices",
  requirePermission("gps.manage"),
  validate(z.object({
    serialNumber: z.string().min(3).max(64),
    vendor: z.string().max(80).optional(),
    firmware: z.string().max(40).optional(),
    notes: z.string().max(240).optional(),
  })),
  auditAction("gps.device.register", "GpsDevice"),
  async (req, res, next) => {
    try {
      const device = await registerGpsDevice(req.body);
      res.locals.entityId = device.id;
      return ok(res, device, "GPS device registered", 201);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/gps-devices/:id/connect",
  requirePermission("gps.manage"),
  validate(z.object({ busId: z.string().uuid() })),
  auditAction("gps.device.connect", "GpsDevice"),
  async (req, res, next) => {
    try {
      const device = await connectGpsDevice(param(req, "id"), req.body.busId);
      res.locals.entityId = device.id;
      return ok(res, device, "GPS device connected");
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/gps-devices/:id/disconnect",
  requirePermission("gps.manage"),
  auditAction("gps.device.disconnect", "GpsDevice"),
  async (req, res, next) => {
    try {
      const device = await disconnectGpsDevice(param(req, "id"));
      res.locals.entityId = device.id;
      return ok(res, device, "GPS device disconnected");
    } catch (err) {
      next(err);
    }
  },
);

export default router;
