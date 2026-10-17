import { Router } from "express";
import { z } from "zod";
import { ok } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { optionalAuth } from "../middlewares/auth.js";
import { qrEmergencyLimiter } from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import { createQrEmergency, getPublicBusByQrToken } from "../services/publicBus.service.js";

const router = Router();

/** Operator list for driver self-registration (id + name only). */
router.get("/companies", async (_req, res, next) => {
  try {
    const items = await prisma.transportCompany.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });
    return ok(res, items);
  } catch (err) {
    next(err);
  }
});

router.get("/buses/:qrToken", async (req, res, next) => {
  try {
    const data = await getPublicBusByQrToken(String(req.params.qrToken ?? ""));
    return ok(res, data, "Public vehicle card");
  } catch (err) {
    next(err);
  }
});

router.post(
  "/buses/:qrToken/emergency",
  qrEmergencyLimiter,
  optionalAuth,
  validate(
    z.object({
      message: z.string().max(500).optional(),
      category: z.enum(["SAFETY", "MEDICAL", "ACCIDENT", "OTHER"]).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await createQrEmergency({
        qrToken: String(req.params.qrToken ?? ""),
        userId: req.user?.id,
        roles: req.user?.roles,
        message: req.body.message,
        category: req.body.category,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
      });
      return ok(res, data, "Emergency SOS sent to monitoring parties", 201);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
