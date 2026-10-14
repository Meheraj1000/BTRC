import { Router } from "express";
import { z } from "zod";
import { ok } from "../lib/apiResponse.js";
import { authRequired } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import * as auth from "../services/auth.service.js";
import { passwordSchema } from "../utils/password.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  fullName: z.string().min(2).max(120),
  phone: z.string().min(8).max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const data = await auth.registerPassenger(req.body);
    return ok(res, data, "Account created", 201);
  } catch (err) {
    next(err);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const data = await auth.login(req.body.email, req.body.password);
    return ok(res, data, "Logged in");
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", validate(z.object({ refreshToken: z.string().min(10) })), async (req, res, next) => {
  try {
    const data = await auth.refresh(req.body.refreshToken);
    return ok(res, data, "Token refreshed");
  } catch (err) {
    next(err);
  }
});

router.post("/logout", authRequired, async (req, res, next) => {
  try {
    await auth.logout(req.user!.id);
    return ok(res, null, "Logged out");
  } catch (err) {
    next(err);
  }
});

router.post(
  "/change-password",
  authRequired,
  validate(z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })),
  async (req, res, next) => {
    try {
      const data = await auth.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
      return ok(res, data, "Password changed");
    } catch (err) {
      next(err);
    }
  },
);

router.get("/me", authRequired, async (req, res, next) => {
  try {
    const data = await auth.me(req.user!.id);
    return ok(res, data);
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/me",
  authRequired,
  validate(z.object({
    fullName: z.string().min(2).max(120).optional(),
    phone: z.string().min(8).max(20).nullable().optional(),
    emergencyContact: z.string().min(8).max(20).nullable().optional(),
    emergencyName: z.string().min(2).max(80).nullable().optional(),
    preferredLanguage: z.string().min(2).max(8).optional(),
  }).refine((value) => Object.keys(value).length > 0, { message: "No fields to update" })),
  async (req, res, next) => {
    try {
      const data = await auth.updateMe(req.user!.id, req.body);
      return ok(res, data, "Profile updated");
    } catch (err) {
      next(err);
    }
  },
);

export default router;
