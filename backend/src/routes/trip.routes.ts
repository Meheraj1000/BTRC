import { Router } from "express";
import { z } from "zod";
import { ApiError, ok } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middlewares/auth.js";
import { requireAnyPermission, requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import { notifyUser } from "../services/notification.service.js";
import { param } from "../utils/http.js";
import { canStartNormalTrip, tripBlockReason } from "../utils/busDto.js";
import { driverAssignmentBlockReason, isDriverEligibleForDuty } from "../utils/driverDto.js";
import { ownerCompanyId } from "../utils/scope.js";

const router = Router();
router.use(authRequired);

router.get("/", requireAnyPermission("trips.own", "trips.manage", "analytics.read"), async (req, res, next) => {
  try {
    const companyId = await ownerCompanyId(req);
    const isDriver = req.user!.roles.includes("DRIVER") && !req.user!.roles.includes("SUPER_ADMIN");
    const driver = isDriver ? await prisma.driver.findUnique({ where: { userId: req.user!.id } }) : null;
    const items = await prisma.trip.findMany({
      where: {
        driverId: driver?.id,
        bus: companyId ? { companyId } : undefined,
      },
      include: {
        bus: { select: { registrationNo: true, companyId: true } },
        driver: { include: { user: { select: { fullName: true } } } },
        route: { select: { name: true, code: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 200,
    });
    return ok(res, items);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAnyPermission("trips.own", "trips.manage", "analytics.read"), async (req, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: param(req, "id") },
      include: {
        bus: true,
        driver: { include: { user: { select: { fullName: true } } } },
        route: { include: { stops: { orderBy: { sequence: "asc" } } } },
      },
    });
    if (!trip) throw new ApiError("Trip not found", 404);
    const companyId = await ownerCompanyId(req);
    if (companyId && trip.bus.companyId !== companyId) {
      throw new ApiError("You cannot access another operator's resources", 403);
    }
    const isDriver = req.user!.roles.includes("DRIVER") && !req.user!.roles.includes("SUPER_ADMIN");
    if (isDriver) {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
      if (!driver || trip.driverId !== driver.id) {
        throw new ApiError("You cannot access another driver's trip", 403);
      }
    }
    return ok(res, trip);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/start",
  requirePermission("trips.own"),
  validate(z.object({
    busId: z.string().uuid().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })),
  async (req, res, next) => {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
        include: { buses: true },
      });
      if (!driver) throw new ApiError("Driver profile not found", 404);
      if (!isDriverEligibleForDuty(driver)) {
        throw new ApiError(driverAssignmentBlockReason(driver), 409);
      }
      const bus = req.body.busId
        ? await prisma.bus.findUnique({ where: { id: req.body.busId } })
        : await prisma.bus.findFirst({ where: { driverId: driver.id, deletedAt: null } });
      if (!bus) throw new ApiError("No assigned bus found", 400);
      if (!bus.routeId) throw new ApiError("Bus has no assigned route", 400);
      if (!canStartNormalTrip(bus)) {
        throw new ApiError(tripBlockReason(bus), 409);
      }

      const existing = await prisma.trip.findFirst({
        where: { busId: bus.id, status: "IN_PROGRESS" },
      });
      if (existing) throw new ApiError("An active trip already exists for this bus", 409);
      const driverBusy = await prisma.trip.findFirst({
        where: { driverId: driver.id, status: "IN_PROGRESS" },
      });
      if (driverBusy) throw new ApiError("An active trip already exists for this driver", 409);

      const trip = await prisma.trip.create({
        data: {
          busId: bus.id,
          driverId: driver.id,
          routeId: bus.routeId,
          startLat: req.body.latitude,
          startLng: req.body.longitude,
          dataSource: "SIMULATED",
        },
      });
      await prisma.bus.update({ where: { id: bus.id }, data: { operationalStatus: "ACTIVE" } });
      await notifyUser({
        userId: req.user!.id,
        type: "TRIP_START",
        title: "Trip started",
        body: `Trip started on ${bus.registrationNo}`,
        payload: { tripId: trip.id },
      });
      return ok(res, trip, "Trip started", 201);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/end",
  requirePermission("trips.own"),
  validate(z.object({
    tripId: z.string().uuid().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })),
  async (req, res, next) => {
    try {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
      if (!driver) throw new ApiError("Driver profile not found", 404);
      const trip = req.body.tripId
        ? await prisma.trip.findUnique({ where: { id: req.body.tripId } })
        : await prisma.trip.findFirst({ where: { driverId: driver.id, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" } });
      if (!trip) throw new ApiError("No active trip found", 404);

      const points = await prisma.gpsLocation.count({ where: { tripId: trip.id } });
      const avg = await prisma.gpsLocation.aggregate({
        where: { tripId: trip.id },
        _avg: { speed: true },
      });

      const updated = await prisma.trip.update({
        where: { id: trip.id },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
          endLat: req.body.latitude,
          endLng: req.body.longitude,
          avgSpeed: avg._avg.speed ?? 0,
        },
      });
      await prisma.bus.update({ where: { id: trip.busId }, data: { operationalStatus: "INACTIVE" } });
      await notifyUser({
        userId: req.user!.id,
        type: "TRIP_END",
        title: "Trip ended",
        body: `Trip completed. ${points} GPS samples stored.`,
        payload: { tripId: trip.id },
      });
      return ok(res, updated, "Trip ended");
    } catch (err) {
      next(err);
    }
  },
);

export default router;
