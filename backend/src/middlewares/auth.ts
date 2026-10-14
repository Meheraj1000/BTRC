import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/jwt.js";

async function attachActiveUser(req: Request, token: string) {
  const payload = verifyAccessToken(token);
  const row = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { status: true, deletedAt: true },
  });
  if (!row || row.deletedAt || row.status !== "ACTIVE") {
    throw new ApiError("Invalid or expired token", 401);
  }
  req.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    roles: payload.roles,
  };
}

export function authRequired(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    next(new ApiError("Authentication required", 401));
    return;
  }
  attachActiveUser(req, token).then(() => next()).catch((err) => {
    if (err instanceof ApiError) next(err);
    else next(new ApiError("Invalid or expired token", 401));
  });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    next();
    return;
  }
  attachActiveUser(req, token).then(() => next()).catch(() => next());
}
