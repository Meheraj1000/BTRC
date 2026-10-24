import { Router } from "express";
import { z } from "zod";
import { ApiError, ok } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import * as analytics from "../services/analytics.service.js";
import { buildReportRows, toCsv, toExcel, toPdf, type ReportKind } from "../services/report.service.js";
import { param } from "../utils/http.js";
import { pagination, requestScope } from "../utils/scope.js";
import { placeRecordFilter } from "../utils/policeArea.js";
import { notifyRoles } from "../services/notification.service.js";

const router = Router();
router.use(authRequired);

router.get("/notifications", requirePermission("notifications.read"), async (req, res, next) => {
  try {
    const items = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok(res, items);
  } catch (err) {
    next(err);
  }
});

router.put("/notifications/:id/read", requirePermission("notifications.read"), async (req, res, next) => {
  try {
    const existing = await prisma.notification.findFirst({
      where: { id: param(req, "id"), userId: req.user!.id },
    });
    if (!existing) throw new ApiError("Notification not found", 404);
    const item = await prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() },
    });
    return ok(res, item);
  } catch (err) {
    next(err);
  }
});

router.put("/notifications/read-all", requirePermission("notifications.read"), async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok(res, null, "All notifications marked read");
  } catch (err) {
    next(err);
  }
});

router.post(
  "/notifications/announce",
  requirePermission("settings.manage"),
  validate(z.object({ title: z.string(), body: z.string() })),
  async (req, res, next) => {
    try {
      await notifyRoles(["SUPER_ADMIN", "GOVERNMENT", "POLICE", "BRTA", "TRANSPORT_OWNER"], {
        type: "SYSTEM_ANNOUNCEMENT",
        title: req.body.title,
        body: req.body.body,
      });
      return ok(res, null, "Announcement queued");
    } catch (err) {
      next(err);
    }
  },
);

router.get("/analytics/overview", requirePermission("analytics.read"), async (req, res, next) => {
  try {
    return ok(res, await analytics.overview(await requestScope(req)));
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/series", requirePermission("analytics.read"), async (req, res, next) => {
  try {
    return ok(res, await analytics.series(await requestScope(req)));
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/activity", requirePermission("analytics.read"), async (req, res, next) => {
  try {
    const scope = await requestScope(req);
    return ok(res, await analytics.activity({
      ...scope,
      includeAudit: req.user!.roles.includes("SUPER_ADMIN"),
    }));
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/buses", requirePermission("analytics.read"), async (req, res, next) => {
  try {
    return ok(res, await analytics.busAnalytics(await requestScope(req), req.query as { page?: string; pageSize?: string }));
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/drivers", requirePermission("analytics.read"), async (req, res, next) => {
  try {
    return ok(res, await analytics.driverAnalytics(await requestScope(req), req.query as { page?: string; pageSize?: string }));
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/routes", requirePermission("analytics.read"), async (req, res, next) => {
  try {
    return ok(res, await analytics.routeAnalytics(await requestScope(req), req.query as { page?: string; pageSize?: string }));
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/alerts", requirePermission("analytics.read"), async (req, res, next) => {
  try {
    const scope = await requestScope(req);
    const busFilter = scope.cities
      ? placeRecordFilter(scope.cities)
      : scope.companyId ? { bus: { companyId: scope.companyId } } : {};
    const [byType, bySeverity] = await Promise.all([
      prisma.alert.groupBy({ by: ["type"], where: busFilter, _count: true }),
      prisma.alert.groupBy({ by: ["severity"], where: busFilter, _count: true }),
    ]);
    return ok(res, {
      byType,
      bySeverity,
      dataLabel: "DEMO",
      scope: scope.cities ? "PLACE" : scope.companyId ? "COMPANY" : "DEPLOYMENT",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/:kind", requirePermission("reports.read"), async (req, res, next) => {
  try {
    const kind = param(req, "kind") as ReportKind;
    const format = String(req.query.format ?? "json");
    const rows = await buildReportRows(kind, await requestScope(req));
    const filename = `nirapad-${kind}`;
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
      return res.send(toCsv(rows as Record<string, unknown>[]));
    }
    if (format === "xlsx") {
      const buf = await toExcel(rows as Record<string, unknown>[], kind);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
      return res.send(buf);
    }
    if (format === "pdf") {
      const buf = await toPdf(`Nirapad Transit — ${kind}`, rows as Record<string, unknown>[]);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
      return res.send(buf);
    }
    return ok(res, { dataLabel: "DEMO", rows });
  } catch (err) {
    next(err);
  }
});

router.get("/settings", requirePermission("settings.manage"), async (_req, res, next) => {
  try {
    return ok(res, await prisma.systemSetting.findMany());
  } catch (err) {
    next(err);
  }
});

router.put(
  "/settings",
  requirePermission("settings.manage"),
  validate(z.object({ key: z.string(), value: z.string(), groupName: z.string().optional() })),
  async (req, res, next) => {
    try {
      const item = await prisma.systemSetting.upsert({
        where: { key: req.body.key },
        update: { value: req.body.value, groupName: req.body.groupName ?? "general" },
        create: { key: req.body.key, value: req.body.value, groupName: req.body.groupName ?? "general" },
      });
      return ok(res, item, "Setting saved");
    } catch (err) {
      next(err);
    }
  },
);

router.get("/audit-logs", requirePermission("audit.read"), async (req, res, next) => {
  try {
    const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.auditLog.count(),
    ]);
    return ok(res, {
      items: items.map((row) => ({
        id: row.id,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        createdAt: row.createdAt,
        actor: row.user?.fullName ?? null,
        ipAddress: row.ipAddress,
      })),
      page,
      pageSize,
      total,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/favorites", async (req, res, next) => {
  try {
    const items = await prisma.passengerFavorite.findMany({
      where: { userId: req.user!.id },
      include: { route: true, bus: { select: { registrationNo: true } } },
    });
    return ok(res, items);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/favorites",
  validate(z.object({ routeId: z.string().uuid().optional(), busId: z.string().uuid().optional() })),
  async (req, res, next) => {
    try {
      const item = await prisma.passengerFavorite.create({
        data: { userId: req.user!.id, routeId: req.body.routeId, busId: req.body.busId },
      });
      return ok(res, item, "Saved", 201);
    } catch (err) {
      next(err);
    }
  },
);

router.delete("/favorites/:id", async (req, res, next) => {
  try {
    const existing = await prisma.passengerFavorite.findFirst({
      where: { id: param(req, "id"), userId: req.user!.id },
    });
    if (!existing) throw new ApiError("Favorite not found", 404);
    await prisma.passengerFavorite.delete({ where: { id: existing.id } });
    return ok(res, null, "Removed");
  } catch (err) {
    next(err);
  }
});

export default router;
