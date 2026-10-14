import { AlertSeverity, AlertStatus, AlertType, type Prisma, type RoleCode } from "@prisma/client";
import type { Request } from "express";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { ownerCompanyId, pagination } from "../utils/scope.js";

const alertInclude = {
  bus: { select: { registrationNo: true, companyId: true, operationalStatus: true } },
  driver: { include: { user: { select: { fullName: true } } } },
  route: { select: { code: true, name: true } },
} satisfies Prisma.AlertInclude;

export function projectAlert(row: Prisma.AlertGetPayload<{ include: typeof alertInclude }>) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    status: row.status,
    message: row.message,
    registrationNo: row.bus?.registrationNo ?? null,
    driverName: row.driver?.user?.fullName ?? null,
    routeCode: row.route?.code ?? null,
    routeName: row.route?.name ?? null,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    speed: row.speed == null ? null : Number(row.speed),
    deviationM: row.deviationM == null ? null : Number(row.deviationM),
    dataSource: row.dataSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
  };
}

function isDriverOnly(roles: RoleCode[]) {
  return roles.includes("DRIVER")
    && !roles.includes("SUPER_ADMIN")
    && !roles.includes("TRANSPORT_OWNER")
    && !roles.includes("POLICE")
    && !roles.includes("GOVERNMENT")
    && !roles.includes("BRTA");
}

export async function listAlerts(req: Request) {
  const { skip, take, page, pageSize } = pagination(req.query as { page?: string; pageSize?: string });
  const companyId = await ownerCompanyId(req).catch(() => undefined);
  const roles = req.user?.roles ?? [];
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const where: Prisma.AlertWhereInput = {};

  if (companyId) where.bus = { companyId };
  if (isDriverOnly(roles)) {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
    where.driverId = driver?.id ?? "00000000-0000-0000-0000-000000000000";
  }
  if (typeof req.query.type === "string" && req.query.type) {
    if (!Object.values(AlertType).includes(req.query.type as AlertType)) {
      throw new ApiError("Invalid alert type", 422);
    }
    where.type = req.query.type as AlertType;
  }
  if (typeof req.query.severity === "string" && req.query.severity) {
    if (!Object.values(AlertSeverity).includes(req.query.severity as AlertSeverity)) {
      throw new ApiError("Invalid alert severity", 422);
    }
    where.severity = req.query.severity as AlertSeverity;
  }
  if (typeof req.query.status === "string" && req.query.status) {
    if (!Object.values(AlertStatus).includes(req.query.status as AlertStatus)) {
      throw new ApiError("Invalid alert status", 422);
    }
    where.status = req.query.status as AlertStatus;
  }
  if (q) {
    where.OR = [
      { message: { contains: q, mode: "insensitive" } },
      { bus: { registrationNo: { contains: q, mode: "insensitive" } } },
      { route: { code: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: alertInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.alert.count({ where }),
  ]);

  return {
    items: rows.map(projectAlert),
    page,
    pageSize,
    total,
    dataLabel: "DEMO / SIMULATED",
  };
}

export async function updateAlertStatus(id: string, status: AlertStatus) {
  const existing = await prisma.alert.findUnique({ where: { id } });
  if (!existing) throw new ApiError("Alert not found", 404);
  const row = await prisma.alert.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "RESOLVED" ? new Date() : existing.resolvedAt,
    },
    include: alertInclude,
  });
  return projectAlert(row);
}

export async function listIncidents(req: Request) {
  const companyId = await ownerCompanyId(req).catch(() => undefined);
  const canReadSos = (req.user?.roles ?? []).some((r) => ["SUPER_ADMIN", "GOVERNMENT", "POLICE"].includes(r));
  const alerts = await listAlerts(req);
  const [sosItems, accidents] = await Promise.all([
    canReadSos
      ? prisma.sosRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { fullName: true } } },
      })
      : Promise.resolve([]),
    prisma.accident.findMany({
      where: companyId ? { bus: { companyId } } : undefined,
      orderBy: { reportedAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    items: alerts.items,
    page: alerts.page,
    pageSize: alerts.pageSize,
    total: alerts.total,
    alerts: alerts.items,
    sos: sosItems.map((s) => ({
      id: s.id,
      status: s.status,
      fullName: s.user.fullName,
      latitude: s.latitude == null ? null : Number(s.latitude),
      longitude: s.longitude == null ? null : Number(s.longitude),
      createdAt: s.createdAt,
    })),
    accidents,
    dataLabel: "DEMO / SIMULATED — Alert is the operational event. SOS lifecycle is an application workflow, not a live dispatch.",
  };
}
