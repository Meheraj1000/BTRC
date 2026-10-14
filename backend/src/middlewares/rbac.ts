import type { RoleCode } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/apiResponse.js";
import { hasAnyRole, hasPermission, type PermissionCode } from "../utils/permissions.js";

export function requireRoles(...allowed: RoleCode[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new ApiError("Authentication required", 401));
      return;
    }
    if (!hasAnyRole(req.user.roles, allowed)) {
      next(new ApiError("You do not have access to this resource", 403));
      return;
    }
    next();
  };
}

export function requireAnyPermission(...permissions: PermissionCode[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new ApiError("Authentication required", 401));
      return;
    }
    const ok = permissions.some((p) => hasPermission(req.user!.roles, p));
    if (!ok) {
      next(new ApiError("Insufficient permission", 403));
      return;
    }
    next();
  };
}

const OPS_ROLES: RoleCode[] = ["SUPER_ADMIN", "GOVERNMENT", "BRTA", "POLICE", "TRANSPORT_OWNER", "DRIVER"];

export function requireOpsRole() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new ApiError("Authentication required", 401));
      return;
    }
    if (!hasAnyRole(req.user.roles, OPS_ROLES)) {
      next(new ApiError("This operational view is not available to passengers", 403));
      return;
    }
    next();
  };
}

export function requirePermission(...permissions: PermissionCode[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new ApiError("Authentication required", 401));
      return;
    }
    const ok = permissions.every((p) => hasPermission(req.user!.roles, p));
    if (!ok) {
      next(new ApiError("Insufficient permission", 403));
      return;
    }
    next();
  };
}
