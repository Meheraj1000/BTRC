import { LostFoundClaimStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok } from "../lib/apiResponse.js";
import { auditAction } from "../middlewares/audit.js";
import { authRequired } from "../middlewares/auth.js";
import { requireAnyPermission, requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import * as lostfound from "../services/lostfound.service.js";
import { param } from "../utils/http.js";

const router = Router();
router.use(authRequired);

const itemSchema = z.object({
  category: z.string().min(2).max(120),
  title: z.string().min(2).max(200),
  description: z.string().min(8).max(2000),
  busId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  lostAt: z.string().datetime().optional(),
  foundAt: z.string().datetime().optional(),
  locationText: z.string().max(500).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

router.post(
  "/lost-found/lost",
  requirePermission("lostfound.create"),
  auditAction("lostfound.create", "LostFoundItem"),
  validate(itemSchema),
  async (req, res, next) => {
    try {
      return ok(res, await lostfound.createItem({ userId: req.user!.id, roles: req.user!.roles, kind: "LOST", ...req.body }), "Lost item reported", 201);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/lost-found/found",
  requirePermission("lostfound.create"),
  auditAction("lostfound.create", "LostFoundItem"),
  validate(itemSchema),
  async (req, res, next) => {
    try {
      return ok(res, await lostfound.createItem({ userId: req.user!.id, roles: req.user!.roles, kind: "FOUND", ...req.body }), "Found item reported", 201);
    } catch (err) {
      next(err);
    }
  },
);

router.get("/lost-found", requirePermission("lostfound.read"), async (req, res, next) => {
  try {
    const result = await lostfound.listItems(req);
    return ok(res, result.items);
  } catch (err) {
    next(err);
  }
});

router.get("/lost-found/:id", requirePermission("lostfound.read"), async (req, res, next) => {
  try {
    return ok(res, await lostfound.getItem(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.get("/lost-found/:id/matches", requirePermission("lostfound.read"), async (req, res, next) => {
  try {
    return ok(res, await lostfound.getItem(req, param(req, "id")));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/lost-found/:id/match",
  requirePermission("lostfound.manage"),
  auditAction("lostfound.match", "LostFoundItem"),
  validate(z.object({ matchedItemId: z.string().uuid() })),
  async (req, res, next) => {
    try {
      return ok(res, await lostfound.matchItem(param(req, "id"), req.body.matchedItemId, req.user!.id, req), "Match recorded");
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/lost-found/:id/claim",
  requirePermission("lostfound.claim"),
  auditAction("lostfound.claim", "LostFoundItem"),
  validate(z.object({ claimNote: z.string().min(8).max(2000), claimEvidence: z.string().max(2000).optional() })),
  async (req, res, next) => {
    try {
      return ok(res, await lostfound.claimItem(param(req, "id"), req.user!.id, req.body.claimNote, req.body.claimEvidence), "Claim submitted");
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/lost-found/:id/claim",
  requirePermission("lostfound.manage"),
  auditAction("lostfound.claim", "LostFoundItem"),
  validate(z.object({ decision: z.nativeEnum(LostFoundClaimStatus) })),
  async (req, res, next) => {
    try {
      return ok(res, await lostfound.reviewClaim(param(req, "id"), req.body.decision, req.user!.id, req), "Claim reviewed");
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/lost-found/:id/close",
  requirePermission("lostfound.manage"),
  auditAction("lostfound.status", "LostFoundItem"),
  async (req, res, next) => {
    try {
      return ok(res, await lostfound.closeItem(param(req, "id"), req.user!.id, req), "Item closed");
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/lost-found/:id/cancel",
  requireAnyPermission("lostfound.create", "lostfound.claim"),
  auditAction("lostfound.status", "LostFoundItem"),
  async (req, res, next) => {
    try {
      return ok(res, await lostfound.cancelItem(req, param(req, "id")), "Report cancelled");
    } catch (err) {
      next(err);
    }
  },
);

export default router;