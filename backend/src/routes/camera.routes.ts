import { CameraStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok } from "../lib/apiResponse.js";
import { auditAction } from "../middlewares/audit.js";
import { authRequired } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import * as cameras from "../services/camera.service.js";
import { param } from "../utils/http.js";

const router = Router();
router.use(authRequired);

const listQuery = z.object({
  city: z.string().trim().max(40).optional(),
  status: z.nativeEnum(CameraStatus).optional(),
});

const updateBody = z.object({
  streamUrl: z.string().trim().max(500).nullable().optional(),
  status: z.nativeEnum(CameraStatus).optional(),
});

const plateQuery = z.object({
  plate: z.string().trim().min(3).max(40),
});

router.get("/cameras", requirePermission("cameras.read"), validate(listQuery, "query"), async (req, res, next) => {
  try {
    return ok(res, await cameras.listCameras(req, req.query as z.infer<typeof listQuery>));
  } catch (err) {
    next(err);
  }
});

router.get("/cameras/locate", requirePermission("cameras.read"), validate(plateQuery, "query"), async (req, res, next) => {
  try {
    return ok(res, await cameras.locateVehicle(req, String(req.query.plate ?? "")));
  } catch (err) {
    next(err);
  }
});

router.get("/cameras/marked", requirePermission("cameras.read"), async (req, res, next) => {
  try {
    return ok(res, await cameras.listMarkedVehicles(req));
  } catch (err) {
    next(err);
  }
});

router.get(
  "/cameras/:id",
  requirePermission("cameras.read"),
  auditAction("camera.view", "StreetCamera"),
  async (req, res, next) => {
    try {
      const data = await cameras.getCamera(req, param(req, "id"));
      res.locals.entityId = data.id;
      return ok(res, data);
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/cameras/:id",
  requirePermission("cameras.manage"),
  auditAction("camera.update", "StreetCamera"),
  validate(updateBody),
  async (req, res, next) => {
    try {
      const data = await cameras.updateCamera(param(req, "id"), req.body);
      res.locals.entityId = data.id;
      return ok(res, data, "Camera updated");
    } catch (err) {
      next(err);
    }
  },
);

export default router;
