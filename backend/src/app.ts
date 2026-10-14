import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { corsOrigins, env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { authLimiter, generalLimiter } from "./middlewares/rateLimits.js";
import authRoutes from "./routes/auth.routes.js";
import fleetRoutes from "./routes/fleet.routes.js";
import gpsRoutes from "./routes/gps.routes.js";
import platformRoutes from "./routes/platform.routes.js";
import routeRoutes from "./routes/route.routes.js";
import lostFoundRoutes from "./routes/lostfound.routes.js";
import publicRoutes from "./routes/public.routes.js";
import safetyRoutes from "./routes/safety.routes.js";
import tripRoutes from "./routes/trip.routes.js";
import userRoutes from "./routes/users.routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(generalLimiter);
  app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)));

  app.get("/health", (_req, res) => {
    res.json({
      success: true,
      message: "Nirapad Transit API",
      data: {
        status: "ok",
        timezone: "Asia/Dhaka",
        gpsMode: env.GPS_SOURCE_MODE,
        env: env.NODE_ENV,
      },
    });
  });

  const p = env.API_PREFIX;
  app.use(`${p}/auth`, authLimiter, authRoutes);
  app.use(`${p}/public`, publicRoutes);
  app.use(`${p}/gps`, gpsRoutes);
  app.use(`${p}/routes`, routeRoutes);
  app.use(`${p}/users`, userRoutes);
  app.use(`${p}`, fleetRoutes);
  app.use(`${p}/trips`, tripRoutes);
  app.use(`${p}`, safetyRoutes);
  app.use(`${p}`, lostFoundRoutes);
  app.use(`${p}`, platformRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
