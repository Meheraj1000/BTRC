import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TZ: z.string().default("Asia/Dhaka"),
  BACKEND_PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  API_PREFIX: z.string().default("/api"),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("8h"),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  GPS_SOURCE_MODE: z.enum(["SIMULATION", "DEVICE"]).default("SIMULATION"),
  GPS_OVERSPEED_MARGIN_KMH: z.coerce.number().default(0),
  GPS_STALE_SECONDS: z.coerce.number().default(45),
  GPS_MAX_JUMP_KM: z.coerce.number().default(50),
  GPS_TIMESTAMP_FUTURE_SEC: z.coerce.number().default(300),
  GPS_TIMESTAMP_PAST_HOURS: z.coerce.number().default(24),
  ROUTE_DEVIATION_THRESHOLD_METERS: z.coerce.number().default(250),
  ROUTE_NEAR_THRESHOLD_METERS: z.coerce.number().default(100),
  ROUTE_DEVIATION_CONSECUTIVE: z.coerce.number().int().min(1).default(3),
  ROUTE_RETURN_CONSECUTIVE: z.coerce.number().int().min(1).default(2),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().default(5),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed. Copy .env.example to .env and set required secrets.");
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
