import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";
import PDFDocument from "pdfkit";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { busPlaceWhere, driverPlaceWhere, placeRecordFilter } from "../utils/policeArea.js";

export type ReportScope = { companyId?: string; cities?: string[] };

function busScope(scope?: ReportScope): Prisma.BusWhereInput {
  const where: Prisma.BusWhereInput = { deletedAt: null };
  if (scope?.companyId) where.companyId = scope.companyId;
  if (scope?.cities) where.AND = [busPlaceWhere(scope.cities)];
  return where;
}

function limited(scope?: ReportScope) {
  return Boolean(scope?.companyId || scope?.cities);
}

export type ReportKind =
  | "bus-activity"
  | "driver-performance"
  | "route-violations"
  | "speed-violations"
  | "sos"
  | "complaints"
  | "trips"
  | "vehicle-status";

export async function buildReportRows(kind: ReportKind, scope?: ReportScope) {
  const problems = scope?.cities
    ? placeRecordFilter(scope.cities)
    : scope?.companyId ? { bus: { companyId: scope.companyId } } : {};
  switch (kind) {
    case "bus-activity":
      return prisma.bus.findMany({
        where: limited(scope) ? busScope(scope) : { deletedAt: null },
        include: { company: true, route: true, _count: { select: { trips: true, alerts: true } } },
      }).then((rows) =>
        rows.map((b) => ({
          registration: b.registrationNo,
          company: b.company.name,
          route: b.route?.name ?? "",
          status: b.operationalStatus,
          trips: b._count.trips,
          alerts: b._count.alerts,
        })),
      );
    case "driver-performance":
      return prisma.driver.findMany({
        where: {
          deletedAt: null,
          ...(scope?.companyId ? { companyId: scope.companyId } : {}),
          ...(scope?.cities ? { AND: [driverPlaceWhere(scope.cities)] } : {}),
        },
        include: { user: true, company: true },
      }).then((rows) =>
        rows.map((d) => ({
          name: d.user.fullName,
          license: d.licenseNumber,
          company: d.company?.name ?? "",
          score: Number(d.performanceScore),
          violations: d.violationCount,
          licenseStatus: d.licenseStatus,
        })),
      );
    case "route-violations":
      return prisma.alert.findMany({
        where: { type: "ROUTE_DEVIATION", ...problems },
        include: { bus: true, driver: { include: { user: true } } },
        take: 500,
        orderBy: { createdAt: "desc" },
      }).then((rows) =>
        rows.map((a) => ({
          time: a.createdAt.toISOString(),
          bus: a.bus?.registrationNo ?? "",
          driver: a.driver?.user.fullName ?? "",
          message: a.message,
          deviationM: a.deviationM ? Number(a.deviationM) : "",
        })),
      );
    case "speed-violations":
      return prisma.alert.findMany({
        where: { type: "OVERSPEED", ...problems },
        include: { bus: true, driver: { include: { user: true } } },
        take: 500,
        orderBy: { createdAt: "desc" },
      }).then((rows) =>
        rows.map((a) => ({
          time: a.createdAt.toISOString(),
          bus: a.bus?.registrationNo ?? "",
          driver: a.driver?.user.fullName ?? "",
          speed: a.speed ? Number(a.speed) : "",
          allowed: a.allowedSpeed ?? "",
        })),
      );
    case "sos":
      return prisma.sosRequest.findMany({
        where: problems,
        include: { user: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }).then((rows) =>
        rows.map((s) => ({
          time: s.createdAt.toISOString(),
          name: s.user.fullName,
          status: s.status,
          lat: s.latitude == null ? "" : Number(s.latitude),
          lng: s.longitude == null ? "" : Number(s.longitude),
          message: s.message ?? "",
        })),
      );
    case "complaints":
      return prisma.complaint.findMany({
        where: problems,
        include: { passenger: true, bus: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }).then((rows) =>
        rows.map((c) => ({
          time: c.createdAt.toISOString(),
          passenger: c.passenger.fullName,
          bus: c.bus?.registrationNo ?? "",
          category: c.category,
          status: c.status,
        })),
      );
    case "trips":
      return prisma.trip.findMany({
        where: limited(scope) ? { bus: busScope(scope) } : undefined,
        include: { bus: true, driver: { include: { user: true } }, route: true },
        take: 500,
        orderBy: { startedAt: "desc" },
      }).then((rows) =>
        rows.map((t) => ({
          started: t.startedAt.toISOString(),
          ended: t.endedAt?.toISOString() ?? "",
          bus: t.bus.registrationNo,
          driver: t.driver.user.fullName,
          route: t.route.name,
          status: t.status,
          maxSpeed: t.maxSpeed ? Number(t.maxSpeed) : "",
          dataSource: t.dataSource,
        })),
      );
    case "vehicle-status":
      return prisma.bus.findMany({
        where: limited(scope) ? busScope(scope) : { deletedAt: null },
        include: { company: true },
      }).then((rows) =>
        rows.map((b) => ({
          registration: b.registrationNo,
          company: b.company.name,
          fitness: b.fitnessStatus,
          registrationStatus: b.registrationStatus,
          insurance: b.insuranceStatus,
          operational: b.operationalStatus,
        })),
      );
    default:
      return [];
  }
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "message\nNo rows\n";
  return stringify(rows, { header: true });
}

export async function toExcel(rows: Record<string, unknown>[], sheetName: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nirapad Transit";
  const sheet = wb.addWorksheet(sheetName);
  if (!rows.length) {
    sheet.addRow(["No rows"]);
  } else {
    const keys = Object.keys(rows[0]);
    sheet.columns = keys.map((k) => ({ header: k, key: k, width: 22 }));
    rows.forEach((r) => sheet.addRow(r));
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function toPdf(title: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(16).text(title);
    doc.fontSize(9).fillColor("#666").text("Demo / simulation report — Asia/Dhaka — Nirapad Transit");
    doc.moveDown();
    doc.fillColor("#111").fontSize(8);
    rows.slice(0, 80).forEach((row, i) => {
      doc.text(`${i + 1}. ${Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(" | ")}`);
      doc.moveDown(0.3);
    });
    if (rows.length > 80) doc.text(`… ${rows.length - 80} additional rows omitted in PDF preview`);
    doc.end();
  });
}
