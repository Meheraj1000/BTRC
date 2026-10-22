import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { ApiError, ok } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { authRequired, optionalAuth } from "../middlewares/auth.js";
import { gpsIngestLimiter, gpsReadLimiter } from "../middlewares/rateLimits.js";
import { requireOpsRole, requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import {
  estimateArrival,
  getLatestLocations,
  getLatestLocationsNear,
  getLocationHistory,
  ingestLocation,
} from "../services/gps.service.js";
import { authenticateGpsDevice, markGpsDeviceSeen } from "../services/gpsDevice.service.js";
import { haversineMeters } from "../utils/geo.js";
import { canSeeOperationalGps, projectGps, toPublicGpsDto } from "../utils/gpsDto.js";
import { param } from "../utils/http.js";
import { assertCanViewBus } from "../services/bus.service.js";
import { ownerCompanyId, pagination } from "../utils/scope.js";

async function ownerCompanyIfNeeded(req: Request) {
  if (!req.user?.roles.includes("TRANSPORT_OWNER")) return undefined;
  return ownerCompanyId(req);
}

function projectScoped(row: Parameters<typeof projectGps>[0], roles: Parameters<typeof projectGps>[1], ownerCompany?: string) {
  const dto = projectGps(row, roles);
  if (dto.projection === "OPERATIONAL" && ownerCompany && dto.companyId !== ownerCompany) {
    return toPublicGpsDto(row);
  }
  return dto;
}

const router = Router();

const ingestSchema = z.object({
  busId: z.string().uuid().optional(),
  deviceId: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).max(200),
  heading: z.number().min(0).max(360),
  timestamp: z.string().optional(),
  routeId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  source: z.enum(["SIMULATION", "DEVICE", "PUBLIC_DATASET", "SYNTHETIC"]).optional(),
});

function deviceKeyOrUser(req: Request, res: Response, next: NextFunction) {
  if (req.header("x-gps-device-key")) {
    next();
    return;
  }
  authRequired(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    requirePermission("gps.ingest")(req, res, next);
  });
}

router.post("/location", gpsIngestLimiter, deviceKeyOrUser, validate(ingestSchema), async (req, res, next) => {
  try {
    const deviceKey = req.header("x-gps-device-key");
    if (deviceKey) {
      const device = await authenticateGpsDevice(deviceKey);
      const data = await ingestLocation(
        { ...req.body, busId: device.busId, deviceId: device.id, source: "DEVICE" },
        undefined,
        { viaDevice: true },
      );
      await markGpsDeviceSeen(device.id);
      return ok(res, data, "Device location stored");
    }
    if (req.body.source === "DEVICE" && env.GPS_SOURCE_MODE !== "DEVICE") {
      throw new ApiError("DEVICE source rejected while GPS_SOURCE_MODE is SIMULATION. Use a connected device key.", 400);
    }
    const busId = req.body.busId;
    if (!busId) throw new ApiError("busId is required", 422);
    const data = await ingestLocation({ ...req.body, busId }, req.user);
    return ok(res, data, "Location stored");
  } catch (err) {
    next(err);
  }
});

router.get("/live", gpsReadLimiter, optionalAuth, async (req, res, next) => {
  try {
    const ownerCompany = await ownerCompanyIfNeeded(req);
    const latest = await getLatestLocations();
    const scoped = ownerCompany ? latest.filter((row) => row.bus.companyId === ownerCompany) : latest;
    const items = scoped.map((row) => projectScoped(row, req.user?.roles, ownerCompany));
    return ok(res, {
      projection: canSeeOperationalGps(req.user?.roles) ? "OPERATIONAL" : "PUBLIC",
      dataLabel: env.GPS_SOURCE_MODE === "DEVICE" ? "REAL" : "SIMULATED",
      items,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/nearby", gpsReadLimiter, optionalAuth, async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radiusM ?? 3000);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ApiError("lat and lng query params are required", 422);
    }
    const boxed = await getLatestLocationsNear(lat, lng, radius);
    const ownerCompany = await ownerCompanyIfNeeded(req);
    const scoped = ownerCompany ? boxed.filter((row) => row.bus.companyId === ownerCompany) : boxed;
    const items = scoped
      .map((row) => ({
        ...projectScoped(row, req.user?.roles, ownerCompany),
        distanceM: haversineMeters(
          { lat, lng },
          { lat: Number(row.latitude), lng: Number(row.longitude) },
        ),
      }))
      .filter((row) => row.distanceM <= radius)
      .sort((a, b) => a.distanceM - b.distanceM);
    return ok(res, {
      projection: canSeeOperationalGps(req.user?.roles) ? "OPERATIONAL" : "PUBLIC",
      dataLabel: env.GPS_SOURCE_MODE === "DEVICE" ? "REAL" : "SIMULATED",
      items,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/buses/:id/location", gpsReadLimiter, optionalAuth, async (req, res, next) => {
  try {
    const [latest] = await getLatestLocations([param(req, "id")]);
    if (!latest) throw new ApiError("No location for this bus", 404);
    const ownerCompany = await ownerCompanyIfNeeded(req);
    if (ownerCompany && latest.bus.companyId !== ownerCompany) {
      throw new ApiError("You cannot access another operator's resources", 403);
    }
    return ok(res, projectScoped(latest, req.user?.roles, ownerCompany));
  } catch (err) {
    next(err);
  }
});

router.get("/buses/:id/history", authRequired, requireOpsRole(), requirePermission("buses.read"), async (req, res, next) => {
  try {
    const bus = await prisma.bus.findFirst({
      where: { id: param(req, "id") },
      select: { companyId: true, driverId: true },
    });
    if (!bus) throw new ApiError("Bus not found", 404);
    await assertCanViewBus(req, bus);
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    if (from && Number.isNaN(from.getTime())) throw new ApiError("Invalid from timestamp", 422);
    if (to && Number.isNaN(to.getTime())) throw new ApiError("Invalid to timestamp", 422);
    const { page, pageSize } = pagination({
      page: req.query.page as string | undefined,
      pageSize: (req.query.pageSize ?? req.query.take) as string | undefined,
    });
    const raw = await getLocationHistory(param(req, "id"), from, to, page, pageSize);
    const items = canSeeOperationalGps(req.user?.roles)
      ? raw.items
      : raw.items.map((row) => ({
          busId: row.busId,
          latitude: row.latitude,
          longitude: row.longitude,
          speed: row.speed,
          heading: row.heading,
          timestamp: row.timestamp,
          source: row.source,
        }));
    return ok(res, {
      dataLabel: "MIXED — inspect source field per row",
      items,
      page: raw.page,
      pageSize: raw.pageSize,
      total: raw.total,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/buses/:id/eta", gpsReadLimiter, optionalAuth, async (req, res, next) => {
  try {
    const data = await estimateArrival(param(req, "id"));
    return ok(res, data);
  } catch (err) {
    next(err);
  }
});

router.get("/source-mode", (_req, res) => {
  return ok(res, {
    mode: env.GPS_SOURCE_MODE,
    note: env.GPS_SOURCE_MODE === "SIMULATION"
      ? "No physical GPS device or government feed is connected."
      : "DEVICE mode is enabled. Confirm a real ingest source is configured.",
  });
});

export default router;
