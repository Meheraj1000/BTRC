import winston from "winston";
import { env } from "./env.js";

const redact = winston.format((info) => {
  const banned = ["password", "passwordHash", "token", "jwt", "secret", "authorization"];
  const scrub = (value: unknown): unknown => {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(scrub);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = banned.some((b) => k.toLowerCase().includes(b)) ? "[REDACTED]" : scrub(v);
    }
    return out;
  };
  return { ...info, ...(scrub(info) as object) };
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: "nirapad-backend", timezone: "Asia/Dhaka" },
  format: winston.format.combine(
    redact(),
    winston.format.timestamp({ format: () => new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === "production"
        ? winston.format.json()
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});
