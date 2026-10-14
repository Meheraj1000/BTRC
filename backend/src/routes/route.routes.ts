import { UserStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok } from "../lib/apiResponse.js";
import { auditAction } from "../middlewares/audit.js";
import { authRequired, optionalAuth } from "../middlewares/auth.js";
import { requireAnyPermission, requireOpsRole, requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import {
  addStop,
  archiveRoute,
  assignBusToRoute,
  changeRouteStatus,
  createRoute,
  getRoute,
  listRoutes,
  removeStop,
  replaceStops,
  unassignBusFromRoute,
  updateRoute,
  updateStop,
} from "../services/route.service.js";
import {
  busCompliance,
  complianceSummary,
  listComplianceEvents,
  routeCompliance,
} from "../services/routeCompliance.service.js";
import { param } from "../utils/http.js";

const router = Router();

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

const stopSchema = z.object({
  name: z.string().min(1).max(80),
  sequence: z.number().int().min(1),
  latitude: lat,
  longitude: lng,
  dwellSeconds: z.number().int().min(0).max(600).optional(),
});

const polylineSchema = z.array(z.object({ lat, lng })).min(2);

const routeCreateSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(120),
  startName: z.string().min(1).max(80),
  endName: z.string().min(1).max(80),
  startLat: lat,
  startLng: lng,
  endLat: lat,
  endLng: lng,
  city: z.string().min(2).max(80),
  allowedSpeed: z.number().int().positive().max(120).optional(),
  polyline: polylineSchema,
  companyId: z.string().uuid().optional().nullable(),
  stops: z.array(stopSchema).optional(),
});

const routeUpdateSchema = routeCreateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "No fields to update",
});

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    return ok(res, await listRoutes(req));
  } catch (err) {
    next(err);
  }
});

router.get("/compliance/summary", authRequired, requireOpsRole(), requireAnyPermission("routes.read", "analytics.read"), async (req, res, next) => {
  try {
    return ok(res, await complianceSummary(req));
  } catch (err) {
    next(err);
  }
});

router.get("/compliance/buses/:busId", authRequired, requireOpsRole(), requirePermission("routes.read"), async (req, res, next) => {
  try {
    return ok(res, await busCompliance(req, param(req, "busId")));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    return ok(res, await getRoute(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/compliance", authRequired, requireOpsRole(), requirePermission("routes.read"), async (req, res, next) => {
  try {
    return ok(res, await routeCompliance(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/events", authRequired, requireOpsRole(), requirePermission("routes.read"), async (req, res, next) => {
  try {
    return ok(res, await listComplianceEvents(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.post("/", authRequired, requirePermission("routes.manage"), validate(routeCreateSchema), auditAction("route.create", "Route"), async (req, res, next) => {
  try {
    const route = await createRoute(req, req.body);
    res.locals.entityId = route.id;
    return ok(res, route, "Route created", 201);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", authRequired, requirePermission("routes.manage"), validate(routeUpdateSchema), auditAction("route.update", "Route"), async (req, res, next) => {
  try {
    return ok(res, await updateRoute(req, param(req, "id"), req.body), "Route updated");
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", authRequired, requirePermission("routes.manage"), validate(z.object({ status: z.nativeEnum(UserStatus) })), auditAction("route.status", "Route"), async (req, res, next) => {
  try {
    return ok(res, await changeRouteStatus(req, param(req, "id"), req.body.status), "Route status updated");
  } catch (err) {
    next(err);
  }
});

router.put("/:id/stops", authRequired, requirePermission("routes.manage"), validate(z.object({ stops: z.array(stopSchema) })), auditAction("route.stops", "Route"), async (req, res, next) => {
  try {
    return ok(res, await replaceStops(req, param(req, "id"), req.body.stops), "Stops updated");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/stops", authRequired, requirePermission("routes.manage"), validate(stopSchema), auditAction("route.stop.create", "Route"), async (req, res, next) => {
  try {
    return ok(res, await addStop(req, param(req, "id"), req.body), "Stop added", 201);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/stops/:stopId", authRequired, requirePermission("routes.manage"), validate(stopSchema.partial()), auditAction("route.stop.update", "Route"), async (req, res, next) => {
  try {
    return ok(res, await updateStop(req, param(req, "id"), param(req, "stopId"), req.body), "Stop updated");
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/stops/:stopId", authRequired, requirePermission("routes.manage"), auditAction("route.stop.delete", "Route"), async (req, res, next) => {
  try {
    return ok(res, await removeStop(req, param(req, "id"), param(req, "stopId")), "Stop removed");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/assign", authRequired, requirePermission("routes.manage"), validate(z.object({ busId: z.string().uuid() })), auditAction("route.assign", "Route"), async (req, res, next) => {
  try {
    return ok(res, await assignBusToRoute(req, param(req, "id"), req.body.busId), "Vehicle assigned to route");
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/assignments/:busId", authRequired, requirePermission("routes.manage"), auditAction("route.unassign", "Route"), async (req, res, next) => {
  try {
    return ok(res, await unassignBusFromRoute(req, param(req, "id"), param(req, "busId")), "Vehicle removed from route");
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authRequired, requirePermission("routes.manage"), auditAction("route.delete", "Route"), async (req, res, next) => {
  try {
    await archiveRoute(req, param(req, "id"));
    return ok(res, null, "Route archived");
  } catch (err) {
    next(err);
  }
});

export default router;
