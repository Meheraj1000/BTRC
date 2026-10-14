import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError, fail } from "../lib/apiResponse.js";
import { logger } from "../config/logger.js";

export function notFound(_req: Request, res: Response) {
  return fail(res, "Route not found", 404);
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    if (err.status >= 500) logger.error("api_error", { message: err.message, path: req.path });
    return fail(res, err.message, err.status, err.data);
  }
  if (err instanceof ZodError) {
    return fail(res, "Validation failed", 422, err.flatten());
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return fail(res, "A record with this unique value already exists", 409);
    if (err.code === "P2025") return fail(res, "Record not found", 404);
    logger.error("prisma_error", { code: err.code, path: req.path });
    return fail(res, "Database error", 400);
  }
  logger.error("unhandled_error", { err, path: req.path, method: req.method });
  return fail(res, "Internal server error", 500);
}
