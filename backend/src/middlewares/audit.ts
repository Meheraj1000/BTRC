import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { logger } from "../config/logger.js";

export function auditAction(action: string, entity?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      if (res.statusCode >= 400) return;
      prisma.auditLog
        .create({
          data: {
            userId: req.user?.id,
            action,
            entity,
            entityId:
              typeof res.locals.entityId === "string"
                ? res.locals.entityId
                : typeof req.params.id === "string"
                  ? req.params.id
                  : undefined,
            ipAddress: req.ip,
            userAgent: req.get("user-agent") ?? undefined,
            metadata: { method: req.method, path: req.path },
          },
        })
        .catch((err) => logger.warn("audit_write_failed", { err }));
    });
    next();
  };
}
