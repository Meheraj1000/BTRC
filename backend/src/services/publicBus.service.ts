import { randomUUID } from "node:crypto";
import type { RoleCode } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";
import { broadcastAlert, broadcastComplaint } from "../lib/socket.js";
import { trackingState } from "../utils/gpsQuality.js";
import { newQrToken, qrPublicUrl } from "../utils/qrToken.js";
import { notifyCompanyOwner, notifyRoles, notifyUser } from "./notification.service.js";
import { createSos } from "./sos.service.js";

const QR_EMERGENCY_REPORTER_EMAIL = "qr.emergency@nirapad.gov.bd";

const publicInclude = {
  company: { select: { id: true, name: true, city: true } },
  route: {
    select: {
      id: true,
      code: true,
      name: true,
      startName: true,
      endName: true,
      city: true,
      allowedSpeed: true,
    },
  },
  driver: {
    select: {
      id: true,
      licenseStatus: true,
      experienceYears: true,
      status: true,
      user: { select: { fullName: true } },
    },
  },
  latestLoc: true,
} as const;

/** Ensure every bus has a QR token (create path + legacy backfill). */
export async function ensureBusQrToken(busId: string, existing?: string | null) {
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const qrToken = newQrToken();
    try {
      await prisma.bus.update({ where: { id: busId }, data: { qrToken } });
      return qrToken;
    } catch {
      // unique collision — retry
    }
  }
  throw new ApiError("Unable to allocate QR token", 500);
}

export async function getPublicBusByQrToken(token: string) {
  const qrToken = token.trim().toLowerCase();
  if (!/^[a-f0-9]{16,64}$/i.test(qrToken)) {
    throw new ApiError("Invalid QR code", 404);
  }

  const bus = await prisma.bus.findFirst({
    where: { qrToken, deletedAt: null },
    include: publicInclude,
  });
  if (!bus) throw new ApiError("Vehicle not found for this QR code", 404);

  return {
    id: bus.id,
    qrToken: bus.qrToken,
    qrUrl: bus.qrToken ? qrPublicUrl(bus.qrToken) : null,
    registrationNo: bus.registrationNo,
    vehicleType: bus.vehicleType,
    manufacturer: bus.manufacturer,
    model: bus.model,
    capacity: bus.capacity,
    yearOfManufacture: bus.yearOfManufacture,
    operationalStatus: bus.operationalStatus,
    fitnessStatus: bus.fitnessStatus,
    registrationStatus: bus.registrationStatus,
    insuranceStatus: bus.insuranceStatus,
    verificationLabel: "MANUAL / SIMULATED VERIFICATION",
    company: bus.company
      ? { id: bus.company.id, name: bus.company.name, city: bus.company.city }
      : null,
    route: bus.route
      ? {
          id: bus.route.id,
          code: bus.route.code,
          name: bus.route.name,
          startName: bus.route.startName,
          endName: bus.route.endName,
          city: bus.route.city,
          allowedSpeed: bus.route.allowedSpeed,
        }
      : null,
    driver: bus.driver
      ? {
          name: bus.driver.user?.fullName ?? null,
          licenseStatus: bus.driver.licenseStatus,
          experienceYears: bus.driver.experienceYears,
          status: bus.driver.status,
        }
      : null,
    latestLoc: bus.latestLoc
      ? {
          latitude: Number(bus.latestLoc.latitude),
          longitude: Number(bus.latestLoc.longitude),
          speed: Number(bus.latestLoc.speed),
          heading: Number(bus.latestLoc.heading),
          timestamp: bus.latestLoc.timestamp,
          trackingState: trackingState(bus.latestLoc.timestamp),
          dataLabel: "SIMULATED",
        }
      : null,
    passengerActions: {
      complaintPath: `/passenger/complaints?busId=${bus.id}`,
      canSubmitComplaint: true,
      canSendEmergency: true,
      note: "Use Emergency to alert monitoring desks instantly. Sign in for a normal complaint or inquiry.",
    },
  };
}

async function resolveEmergencyReporter(userId?: string) {
  if (userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, fullName: true },
    });
    if (user) return { id: user.id, fullName: user.fullName, anonymous: false };
  }

  const reporter = await prisma.user.findUnique({
    where: { email: QR_EMERGENCY_REPORTER_EMAIL },
    select: { id: true, fullName: true },
  });
  if (!reporter) {
    throw new ApiError("Emergency reporter account is not configured. Run database seed.", 503);
  }
  return { id: reporter.id, fullName: reporter.fullName, anonymous: true };
}

/**
 * Instant QR emergency: CRITICAL complaint + SOS alert to all monitoring parties.
 * Application workflow only — not live 999 / police / ambulance dispatch.
 */
export async function createQrEmergency(input: {
  qrToken: string;
  userId?: string;
  roles?: RoleCode[];
  message?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
}) {
  const qrToken = input.qrToken.trim().toLowerCase();
  if (!/^[a-f0-9]{16,64}$/i.test(qrToken)) {
    throw new ApiError("Invalid QR code", 404);
  }

  const bus = await prisma.bus.findFirst({
    where: { qrToken, deletedAt: null },
    include: {
      company: { select: { id: true, name: true, ownerUserId: true } },
      route: { select: { id: true, code: true, name: true, city: true } },
      driver: { select: { id: true, userId: true, user: { select: { fullName: true } } } },
      latestLoc: true,
    },
  });
  if (!bus) throw new ApiError("Vehicle not found for this QR code", 404);

  const reporter = await resolveEmergencyReporter(input.userId);
  const lat =
    typeof input.latitude === "number" && Number.isFinite(input.latitude)
      ? input.latitude
      : bus.latestLoc
        ? Number(bus.latestLoc.latitude)
        : null;
  const lng =
    typeof input.longitude === "number" && Number.isFinite(input.longitude)
      ? input.longitude
      : bus.latestLoc
        ? Number(bus.latestLoc.longitude)
        : null;

  const sosCategory = ["SAFETY", "MEDICAL", "ACCIDENT", "OTHER"].includes(input.category ?? "")
    ? input.category!
    : "SAFETY";

  const message =
    (input.message?.trim() ||
      `QR emergency on ${bus.registrationNo}${bus.route?.code ? ` (${bus.route.code})` : ""}. Immediate attention requested.`) +
    (reporter.anonymous ? " [Anonymous QR scan]" : "");

  const complaint = await prisma.complaint.create({
    data: {
      reference: `EMG-${Date.now()}-${randomUUID().slice(0, 8)}`,
      passengerId: reporter.id,
      busId: bus.id,
      driverId: bus.driverId,
      routeId: bus.routeId,
      category: "HARASSMENT_SECURITY",
      subject: `QR Emergency SOS · ${sosCategory}`,
      description: message,
      priority: "CRITICAL",
      status: "PENDING",
      latitude: lat,
      longitude: lng,
    },
    include: {
      passenger: { select: { id: true, fullName: true } },
      bus: { select: { id: true, registrationNo: true, companyId: true, routeId: true } },
      driver: { select: { id: true, user: { select: { fullName: true } } } },
      route: { select: { id: true, code: true, name: true, companyId: true } },
    },
  });

  const alert = await prisma.alert.create({
    data: {
      type: "SOS",
      severity: "CRITICAL",
      busId: bus.id,
      driverId: bus.driverId,
      routeId: bus.routeId,
      latitude: lat,
      longitude: lng,
      message: `QR EMERGENCY · ${bus.registrationNo}: ${message}`,
      dataSource: "SIMULATED",
    },
  });

  let sosId: string | null = null;
  if (input.userId && input.roles?.length) {
    try {
      const sos = await createSos({
        userId: input.userId,
        roles: input.roles,
        busId: bus.id,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        message,
        category: sosCategory,
        idempotencyKey: `qr-emg-${input.userId}-${bus.id}-${Math.floor(Date.now() / 120_000)}`,
      });
      sosId = String((sos as { id?: string }).id ?? "") || null;
    } catch {
      // Complaint + alert already cover anonymous/guest and active-SOS collisions.
    }
  }

  const notifyBody = `CRITICAL QR emergency for ${bus.registrationNo}${bus.company?.name ? ` · ${bus.company.name}` : ""}. Open Emergencies / Complaints. Not a live 999 dispatch.`;
  const payload = {
    complaintId: complaint.id,
    alertId: alert.id,
    busId: bus.id,
    registrationNo: bus.registrationNo,
    driverId: bus.driverId,
    driverName: bus.driver?.user.fullName ?? null,
    routeId: bus.routeId,
    routeCode: bus.route?.code ?? null,
    sosId,
    source: "QR_EMERGENCY",
  };

  await notifyRoles(["SUPER_ADMIN", "GOVERNMENT", "POLICE", "BRTA"], {
    type: "SOS",
    title: "QR emergency alert",
    body: notifyBody,
    payload,
  });
  await notifyCompanyOwner(bus.companyId, {
    type: "SOS",
    title: "QR emergency on your vehicle",
    body: notifyBody,
    payload,
  });
  if (bus.driver?.userId) {
    await notifyUser({
      userId: bus.driver.userId,
      type: "SOS",
      title: "QR emergency on your assigned bus",
      body: notifyBody,
      payload,
    });
  }
  if (!reporter.anonymous) {
    await notifyUser({
      userId: reporter.id,
      type: "COMPLAINT_UPDATE",
      title: "Emergency complaint recorded",
      body: "Your QR emergency was recorded for authorized monitoring. This is not a live police, ambulance, or 999 dispatch.",
      payload,
    });
  }

  try {
    broadcastAlert({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      registrationNo: bus.registrationNo,
      driverName: bus.driver?.user.fullName ?? null,
      routeCode: bus.route?.code ?? null,
      createdAt: alert.createdAt,
      latitude: lat,
      longitude: lng,
      complaintId: complaint.id,
      sosId,
      dataLabel: "QR EMERGENCY — application workflow, not live dispatch",
    }, bus.companyId, bus.route?.city ?? null);
    broadcastComplaint(
      {
        id: complaint.id,
        reference: complaint.reference,
        category: complaint.category,
        priority: complaint.priority,
        status: complaint.status,
        subject: complaint.subject,
        busRegistrationNo: bus.registrationNo,
        routeCode: bus.route?.code ?? null,
        createdAt: complaint.createdAt,
        source: "QR_EMERGENCY",
      },
      bus.companyId,
      bus.route?.city ?? null,
    );
  } catch {
    // sockets may be unavailable in tests
  }

  return {
    ok: true,
    complaintId: complaint.id,
    complaintReference: complaint.reference,
    alertId: alert.id,
    sosId,
    registrationNo: bus.registrationNo,
    anonymous: reporter.anonymous,
    disclaimer: "Recorded in this application for authorized monitoring parties. Not connected to live 999, police, or ambulance dispatch.",
  };
}
