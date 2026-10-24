import type { PrismaClient, RoleCode } from "@prisma/client";
import type { Request } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { assertCanViewBus } from "./bus.service.js";
import { conditionIssues, type BusIssueDetail } from "../utils/busIssue.js";
import { hasPermission } from "../utils/permissions.js";

const ACTIVE_SOS = ["OPEN", "ACKNOWLEDGED", "DISPATCHED", "INVESTIGATING", "RESPONDING"] as const;
const OPEN_ALERT = ["OPEN", "ACKNOWLEDGED"] as const;
const OPEN_COMPLAINT = ["PENDING", "UNDER_REVIEW"] as const;

const TTL_MS = 4000;
let cached: { at: number; ids: Set<string> } | null = null;

/** Bus ids with an unresolved alert, SOS, or complaint. */
export async function openIssueBusIds(db: PrismaClient = prisma): Promise<Set<string>> {
  if (!process.env.VITEST && cached && Date.now() - cached.at < TTL_MS) return cached.ids;
  const [alerts, sos, complaints] = await Promise.all([
    db.alert.findMany({
      where: { status: { in: [...OPEN_ALERT] }, busId: { not: null } },
      select: { busId: true },
    }),
    db.sosRequest.findMany({
      where: { status: { in: [...ACTIVE_SOS] }, busId: { not: null } },
      select: { busId: true },
    }),
    db.complaint.findMany({
      where: { status: { in: [...OPEN_COMPLAINT] }, busId: { not: null } },
      select: { busId: true },
    }),
  ]);
  const ids = new Set<string>();
  for (const row of [...alerts, ...sos, ...complaints]) {
    if (row.busId) ids.add(row.busId);
  }
  cached = { at: Date.now(), ids };
  return ids;
}

const MONITOR_ROLES: RoleCode[] = ["SUPER_ADMIN", "GOVERNMENT", "POLICE", "BRTA", "TRANSPORT_OWNER"];

function passengerOnly(roles: RoleCode[]) {
  return roles.includes("PASSENGER") && !roles.some((role) => MONITOR_ROLES.includes(role));
}

function clip(value: string, max = 180) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Open problems for one bus: route, speed, service, alerts, SOS, and complaints. */
export async function listBusIssues(req: Request, busId: string) {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    select: {
      id: true,
      registrationNo: true,
      companyId: true,
      driverId: true,
      operationalStatus: true,
      route: { select: { allowedSpeed: true, name: true, city: true } },
      complianceState: { select: { status: true, deviationM: true } },
      latestLoc: { select: { speed: true } },
    },
  });
  if (!bus) throw new ApiError("Bus not found", 404);
  await assertCanViewBus(req, bus);

  const roles = req.user?.roles ?? [];
  const ownOnly = passengerOnly(roles);
  const seeAlertText = hasPermission(roles, "alerts.read");
  const seeComplaintText = hasPermission(roles, "complaints.read");
  const seeSosText = hasPermission(roles, "sos.read");

  const [alertGroups, complaints, complaintCount, sosRows, sosCount] = await Promise.all([
    prisma.alert.groupBy({
      by: ["type"],
      where: { busId, status: { in: [...OPEN_ALERT] } },
      _count: { _all: true },
    }),
    prisma.complaint.findMany({
      where: {
        busId,
        status: { in: [...OPEN_COMPLAINT] },
        ...(ownOnly ? { passengerId: req.user!.id } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { reference: true, subject: true, status: true, passengerId: true },
    }),
    prisma.complaint.count({ where: { busId, status: { in: [...OPEN_COMPLAINT] } } }),
    prisma.sosRequest.findMany({
      where: { busId, status: { in: [...ACTIVE_SOS] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { status: true, message: true, userId: true },
    }),
    prisma.sosRequest.count({ where: { busId, status: { in: [...ACTIVE_SOS] } } }),
  ]);

  const issues: BusIssueDetail[] = conditionIssues({
    complianceStatus: bus.complianceState?.status,
    operationalStatus: bus.operationalStatus,
    speed: bus.latestLoc ? Number(bus.latestLoc.speed) : null,
    allowedSpeed: bus.route?.allowedSpeed ?? null,
    overspeedMargin: env.GPS_OVERSPEED_MARGIN_KMH,
    deviationM: bus.complianceState?.deviationM == null ? null : Number(bus.complianceState.deviationM),
  });

  for (const group of alertGroups) {
    const latest = await prisma.alert.findFirst({
      where: { busId, type: group.type, status: { in: [...OPEN_ALERT] } },
      orderBy: { createdAt: "desc" },
      select: { message: true, status: true },
    });
    issues.push({
      kind: "ALERT",
      label: "Open alert",
      summaryKey: seeAlertText ? undefined : "An alert is still open.",
      summaryText: seeAlertText && latest?.message ? `${group.type}: ${clip(latest.message)}` : group.type,
      status: latest?.status ?? "OPEN",
      count: group._count._all,
    });
  }

  if (sosCount > 0) {
    const own = sosRows.find((row) => row.userId === req.user?.id);
    const sample = seeSosText ? sosRows.find((row) => row.message) : own;
    issues.push({
      kind: "SOS",
      label: "Open SOS",
      summaryKey: "An SOS is recorded in this application. This is not a live 999 dispatch.",
      summaryText: sample?.message ? clip(sample.message) : undefined,
      status: (own ?? sosRows[0])?.status ?? "OPEN",
      count: sosCount,
    });
  }

  if (complaintCount > 0) {
    const visible = complaints[0];
    const canReadThis = visible && (seeComplaintText || visible.passengerId === req.user?.id);
    issues.push({
      kind: "COMPLAINT",
      label: "Open complaint",
      summaryKey: canReadThis ? undefined : "A passenger complaint is still open.",
      summaryText: canReadThis && visible ? `${visible.reference}: ${clip(visible.subject)}` : undefined,
      status: visible?.status ?? "PENDING",
      count: complaintCount,
    });
  }

  return {
    busId: bus.id,
    registrationNo: bus.registrationNo,
    routeName: bus.route?.name ?? null,
    issues,
  };
}
