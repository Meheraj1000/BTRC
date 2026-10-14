import { AlertStatus, ComplaintCategory, ComplaintPriority, ComplaintStatus, SosStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok } from "../lib/apiResponse.js";
import { auditAction } from "../middlewares/audit.js";
import { authRequired } from "../middlewares/auth.js";
import { complaintLimiter, sosLimiter } from "../middlewares/rateLimits.js";
import { requireAnyPermission, requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import * as alerts from "../services/alert.service.js";
import * as complaints from "../services/complaint.service.js";
import * as sos from "../services/sos.service.js";
import { param } from "../utils/http.js";

const router = Router();
router.use(authRequired);

router.post(
  "/sos",
  sosLimiter,
  requirePermission("sos.create"),
  auditAction("sos.create", "SosRequest"),
  validate(z.object({
    busId: z.string().uuid().optional(),
    tripId: z.string().uuid().optional(),
    routeId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    message: z.string().max(500).optional(),
    category: z.enum(["SAFETY", "MEDICAL", "ACCIDENT", "OTHER"]).optional(),
    idempotencyKey: z.string().uuid().optional(),
  })),
  async (req, res, next) => {
    try {
      const data = await sos.createSos({ userId: req.user!.id, roles: req.user!.roles, ...req.body });
      res.locals.entityId = data.id;
      return ok(res, data, data.existing ? "Active SOS already recorded" : "SOS recorded in the application", data.existing ? 200 : 201);
    } catch (err) {
      next(err);
    }
  },
);

router.get("/sos", requireAnyPermission("sos.read", "sos.create"), async (req, res, next) => {
  try {
    return ok(res, await sos.listSos(req));
  } catch (err) {
    next(err);
  }
});

router.get("/sos/:id", requireAnyPermission("sos.read", "sos.create"), async (req, res, next) => {
  try {
    return ok(res, await sos.getSos(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.put(
  "/sos/:id/status",
  requirePermission("sos.manage"),
  auditAction("sos.status", "SosRequest"),
  validate(z.object({ status: z.nativeEnum(SosStatus) })),
  async (req, res, next) => {
    try {
      return ok(res, await sos.updateSosStatus(param(req, "id"), req.body.status, req.user!.id), "SOS updated");
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/sos/:id/cancel",
  requirePermission("sos.create"),
  auditAction("sos.cancel", "SosRequest"),
  async (req, res, next) => {
    try {
      return ok(res, await sos.cancelSos(req, param(req, "id")), "SOS cancelled");
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/sos/:id/note",
  requirePermission("sos.manage"),
  auditAction("sos.note", "SosRequest"),
  validate(z.object({ internalNote: z.string().max(2000) })),
  async (req, res, next) => {
    try {
      return ok(res, await sos.updateSosNote(param(req, "id"), req.body.internalNote), "Internal note saved");
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/complaints",
  complaintLimiter,
  requirePermission("complaints.create"),
  validate(z.object({
    busId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    routeId: z.string().uuid().optional(),
    tripId: z.string().uuid().optional(),
    category: z.nativeEnum(ComplaintCategory),
    subject: z.string().max(200).optional(),
    description: z.string().min(8).max(2000),
    priority: z.nativeEnum(ComplaintPriority).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    evidenceUrl: z.string().url().optional(),
  })),
  async (req, res, next) => {
    try {
      const data = await complaints.createComplaint({ passengerId: req.user!.id, ...req.body });
      return ok(res, data, "Complaint submitted", 201);
    } catch (err) {
      next(err);
    }
  },
);

router.get("/complaints", requirePermission("complaints.read"), async (req, res, next) => {
  try {
    const result = await complaints.listComplaints(req);
    return ok(res, result.items);
  } catch (err) {
    next(err);
  }
});

router.get("/complaints/:id", requirePermission("complaints.read"), async (req, res, next) => {
  try {
    return ok(res, await complaints.getComplaint(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.put(
  "/complaints/:id",
  requirePermission("complaints.manage"),
  auditAction("complaint.status", "Complaint"),
  validate(z.object({ status: z.nativeEnum(ComplaintStatus) })),
  async (req, res, next) => {
    try {
      return ok(res, await complaints.updateComplaintStatus(param(req, "id"), req.body.status, req.user!.id), "Complaint updated");
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/complaints/:id/assign",
  requirePermission("complaints.manage"),
  auditAction("complaint.assign", "Complaint"),
  validate(z.object({ assignedToId: z.string().uuid() })),
  async (req, res, next) => {
    try {
      return ok(res, await complaints.assignComplaint(param(req, "id"), req.body.assignedToId), "Complaint assigned");
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/complaints/:id/note",
  requireAnyPermission("complaints.manage", "complaints.note"),
  auditAction("complaint.note", "Complaint"),
  validate(z.object({ internalNote: z.string().max(2000) })),
  async (req, res, next) => {
    try {
      return ok(res, await complaints.updateComplaintNote(param(req, "id"), req.body.internalNote), "Internal note saved");
    } catch (err) {
      next(err);
    }
  },
);

router.get("/alerts", requirePermission("alerts.read"), async (req, res, next) => {
  try {
    return ok(res, await alerts.listAlerts(req));
  } catch (err) {
    next(err);
  }
});

router.put(
  "/alerts/:id/status",
  requirePermission("alerts.manage"),
  auditAction("alert.status", "Alert"),
  validate(z.object({ status: z.nativeEnum(AlertStatus) })),
  async (req, res, next) => {
    try {
      return ok(res, await alerts.updateAlertStatus(param(req, "id"), req.body.status), "Alert updated");
    } catch (err) {
      next(err);
    }
  },
);

router.get("/incidents", requirePermission("alerts.read"), async (req, res, next) => {
  try {
    return ok(res, await alerts.listIncidents(req));
  } catch (err) {
    next(err);
  }
});

export default router;