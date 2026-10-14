import { RoleCode, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { ApiError, ok } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { auditAction } from "../middlewares/audit.js";
import { authRequired } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import { param } from "../utils/http.js";
import { passwordSchema } from "../utils/password.js";
import { pagination } from "../utils/scope.js";
import { assertNotLastActiveSuperAdmin, revokeRefreshTokens } from "../utils/superAdminGuard.js";

const router = Router();
router.use(authRequired);

function toPublicUser(user: {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  status: string;
  createdAt: Date;
  userRoles: { role: { code: RoleCode } }[];
}) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    status: user.status,
    roles: user.userRoles.map((r) => r.role.code),
    createdAt: user.createdAt,
  };
}

router.get("/meta/roles", requirePermission("roles.manage"), async (_req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      select: { id: true, code: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
    return ok(res, roles);
  } catch (err) {
    next(err);
  }
});

router.get("/", requirePermission("users.manage"), async (req, res, next) => {
  try {
    const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? (req.query.status as UserStatus) : undefined;
    const role = typeof req.query.role === "string" ? (req.query.role as RoleCode) : undefined;
    const where = {
      deletedAt: null,
      status: status && Object.values(UserStatus).includes(status) ? status : undefined,
      userRoles: role && Object.values(RoleCode).includes(role) ? { some: { role: { code: role } } } : undefined,
      OR: q
        ? [
            { email: { contains: q, mode: "insensitive" as const } },
            { fullName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { userRoles: { include: { role: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);
    return ok(res, {
      items: items.map(toPublicUser),
      page,
      pageSize,
      total,
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  fullName: z.string().min(2),
  phone: z.string().optional(),
  role: z.nativeEnum(RoleCode),
});

router.post("/", requirePermission("users.manage"), validate(createSchema), auditAction("user.create", "User"), async (req, res, next) => {
  try {
    const role = await prisma.role.findUnique({ where: { code: req.body.role } });
    if (!role) throw new ApiError("Role is not configured", 400);
    const user = await prisma.user.create({
      data: {
        email: req.body.email.toLowerCase(),
        passwordHash: await bcrypt.hash(req.body.password, 12),
        fullName: req.body.fullName,
        phone: req.body.phone,
        userRoles: { create: { roleId: role.id } },
      },
    });
    return ok(res, { id: user.id }, "User created", 201);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requirePermission("users.manage"), async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: param(req, "id"), deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new ApiError("User not found", 404);
    return ok(res, toPublicUser(user));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requirePermission("users.manage"), auditAction("user.update", "User"), async (req, res, next) => {
  try {
    const body = z.object({
      fullName: z.string().min(2).optional(),
      phone: z.string().optional(),
      status: z.nativeEnum(UserStatus).optional(),
    }).parse(req.body);
    const id = param(req, "id");
    if (body.status && body.status !== "ACTIVE") {
      await assertNotLastActiveSuperAdmin(id);
    }
    const user = await prisma.user.update({ where: { id }, data: body });
    if (body.status && body.status !== "ACTIVE") {
      await revokeRefreshTokens(id);
    }
    return ok(res, { id: user.id, status: user.status }, "User updated");
  } catch (err) {
    next(err);
  }
});

router.put(
  "/:id/roles",
  requirePermission("users.manage"),
  validate(z.object({ roles: z.array(z.nativeEnum(RoleCode)).min(1) })),
  auditAction("user.roles", "User"),
  async (req, res, next) => {
    try {
      const id = param(req, "id");
      const existing = await prisma.user.findFirst({
        where: { id, deletedAt: null },
        include: { userRoles: { include: { role: true } } },
      });
      if (!existing) throw new ApiError("User not found", 404);
      if (existing.userRoles.some((r) => r.role.code === "SUPER_ADMIN") && !req.body.roles.includes("SUPER_ADMIN")) {
        await assertNotLastActiveSuperAdmin(id);
      }
      const roleRows = await prisma.role.findMany({ where: { code: { in: req.body.roles } } });
      if (roleRows.length !== req.body.roles.length) throw new ApiError("One or more roles are not configured", 400);
      await prisma.$transaction([
        prisma.userRole.deleteMany({ where: { userId: id } }),
        prisma.userRole.createMany({
          data: roleRows.map((role) => ({ userId: id, roleId: role.id })),
        }),
      ]);
      return ok(res, { id, roles: req.body.roles }, "Roles updated");
    } catch (err) {
      next(err);
    }
  },
);

router.delete("/:id", requirePermission("users.manage"), auditAction("user.delete", "User"), async (req, res, next) => {
  try {
    const id = param(req, "id");
    await assertNotLastActiveSuperAdmin(id);
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } });
    await revokeRefreshTokens(id);
    return ok(res, null, "User archived");
  } catch (err) {
    next(err);
  }
});

export default router;
