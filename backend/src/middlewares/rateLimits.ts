import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/** Phone traffic arrives through the Vercel proxy, which sets this header to the real client. */
function clientKey(req: Request) {
  const marked = req.get("x-nirapad-client")?.trim() ?? "";
  if (/^[0-9a-f.:]{3,64}$/i.test(marked)) return marked;
  return req.socket.remoteAddress ?? "local";
}

/**
 * Limits (documented for Phase 02):
 * - Auth: 30 / 15 min / IP — brute-force control
 * - GPS ingest: 2400 / min / IP — 16 buses @ 2s ≈ 480/min; headroom for demo fleet
 * - GPS read: 180 / min / IP — live/nearby polling
 * Ingest/read GPS limiters are IP-based (simulator shares one IP). Do not tighten
 * below ~16 buses × 30 samples/min without changing SIMULATOR_INTERVAL_MS.
 * - SOS: 15 / 15 min / IP
 * - Complaints: 30 / 15 min / IP
 * - General: RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS (default 2000 / 15 min)
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: "Too many requests", data: null },
  skip: (req) =>
    req.path === "/health" ||
    req.path.startsWith("/api/gps") ||
    req.path.startsWith("/api/auth"),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: "Too many authentication attempts", data: null },
});

export const gpsIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2400,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: "GPS ingest rate exceeded", data: null },
});

export const gpsReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: "GPS read rate exceeded", data: null },
});

export const sosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: "Too many SOS submissions", data: null },
});

export const complaintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: "Too many complaint submissions", data: null },
});

/** QR emergency button — stricter than normal complaints. */
export const qrEmergencyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: "Too many emergency submissions from this network", data: null },
});
