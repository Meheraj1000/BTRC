import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";

export function newQrToken() {
  return randomBytes(12).toString("hex");
}

export function qrPublicUrl(token: string) {
  const base = env.FRONTEND_URL.replace(/\/$/, "");
  return `${base}/bus/${token}`;
}
