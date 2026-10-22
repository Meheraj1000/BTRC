import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function newDeviceKey() {
  const apiKey = `ntgps_${randomBytes(24).toString("hex")}`;
  return {
    apiKey,
    apiKeyHash: hashKey(apiKey),
    apiKeyHint: apiKey.slice(-4),
  };
}

function projectDevice(device: {
  id: string;
  serialNumber: string;
  vendor: string | null;
  firmware: string | null;
  status: string;
  notes: string | null;
  dataSource: string;
  apiKeyHint: string | null;
  connectedAt: Date | null;
  lastSeenAt: Date | null;
  installedAt: Date | null;
  createdAt: Date;
  bus?: { id: string; registrationNo: string } | null;
}) {
  return {
    id: device.id,
    serialNumber: device.serialNumber,
    vendor: device.vendor,
    firmware: device.firmware,
    status: device.status,
    notes: device.notes,
    dataSource: device.dataSource,
    installedAt: device.installedAt,
    connectedAt: device.connectedAt,
    lastSeenAt: device.lastSeenAt,
    hasApiKey: Boolean(device.apiKeyHint),
    apiKeyHint: device.apiKeyHint,
    connection: device.bus ? "CONNECTED" : "UNBOUND",
    bus: device.bus ? { id: device.bus.id, registrationNo: device.bus.registrationNo } : null,
    createdAt: device.createdAt,
  };
}

const deviceInclude = {
  bus: { select: { id: true, registrationNo: true } },
} as const;

export async function listGpsDevices() {
  const rows = await prisma.gpsDevice.findMany({
    where: { deletedAt: null },
    include: deviceInclude,
    orderBy: { serialNumber: "asc" },
  });
  return rows.map(projectDevice);
}

export async function registerGpsDevice(body: {
  serialNumber: string;
  vendor?: string;
  firmware?: string;
  notes?: string;
}) {
  const serialNumber = body.serialNumber.trim().toUpperCase();
  if (serialNumber.length < 3) throw new ApiError("Serial number is too short", 422);
  const existing = await prisma.gpsDevice.findFirst({ where: { serialNumber, deletedAt: null } });
  if (existing) throw new ApiError("A GPS device with this serial number already exists", 409);

  const device = await prisma.gpsDevice.create({
    data: {
      serialNumber,
      vendor: body.vendor?.trim() || null,
      firmware: body.firmware?.trim() || null,
      notes: body.notes?.trim() || null,
      dataSource: "SIMULATION",
      status: "ACTIVE",
    },
    include: deviceInclude,
  });
  return projectDevice(device);
}

export async function connectGpsDevice(deviceId: string, busId: string) {
  const device = await prisma.gpsDevice.findFirst({
    where: { id: deviceId, deletedAt: null },
    include: deviceInclude,
  });
  if (!device) throw new ApiError("GPS device not found", 404);
  if (device.status !== "ACTIVE") throw new ApiError("This GPS device is not active", 409);

  const bus = await prisma.bus.findFirst({
    where: { id: busId, deletedAt: null },
    select: { id: true, registrationNo: true, gpsDeviceId: true },
  });
  if (!bus) throw new ApiError("Vehicle not found", 404);
  if (bus.gpsDeviceId && bus.gpsDeviceId !== device.id) {
    throw new ApiError("This vehicle already has a GPS device. Disconnect it first.", 409);
  }

  const key = newDeviceKey();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (device.bus && device.bus.id !== bus.id) {
      await tx.bus.update({ where: { id: device.bus.id }, data: { gpsDeviceId: null } });
    }
    await tx.gpsDevice.update({
      where: { id: device.id },
      data: {
        dataSource: "DEVICE",
        apiKeyHash: key.apiKeyHash,
        apiKeyHint: key.apiKeyHint,
        connectedAt: now,
        installedAt: device.installedAt ?? now,
      },
    });
    await tx.bus.update({
      where: { id: bus.id },
      data: { gpsDeviceId: device.id },
    });
  });

  const updated = await prisma.gpsDevice.findUniqueOrThrow({
    where: { id: device.id },
    include: deviceInclude,
  });

  return {
    ...projectDevice(updated),
    apiKey: key.apiKey,
    ingestPath: "/api/gps/location",
    header: "X-GPS-Device-Key",
    note: "Copy this key now. It is stored only as a hash and will not be shown again. Positions sent with this key are labeled DEVICE. The rest of the fleet stays SIMULATED unless GPS_SOURCE_MODE=DEVICE.",
  };
}

export async function disconnectGpsDevice(deviceId: string) {
  const device = await prisma.gpsDevice.findFirst({
    where: { id: deviceId, deletedAt: null },
    include: deviceInclude,
  });
  if (!device) throw new ApiError("GPS device not found", 404);

  await prisma.$transaction(async (tx) => {
    if (device.bus) {
      await tx.bus.update({ where: { id: device.bus.id }, data: { gpsDeviceId: null } });
    }
    await tx.gpsDevice.update({
      where: { id: device.id },
      data: {
        dataSource: "SIMULATION",
        apiKeyHash: null,
        apiKeyHint: null,
        connectedAt: null,
      },
    });
  });

  const updated = await prisma.gpsDevice.findUniqueOrThrow({
    where: { id: device.id },
    include: deviceInclude,
  });
  return projectDevice(updated);
}

/** Resolve a tracker key to the bus it is bound to. */
export async function authenticateGpsDevice(rawKey: string) {
  const key = rawKey.trim();
  if (!key.startsWith("ntgps_") || key.length < 20) {
    throw new ApiError("Invalid GPS device key", 401);
  }
  const device = await prisma.gpsDevice.findFirst({
    where: { apiKeyHash: hashKey(key), deletedAt: null, status: "ACTIVE" },
    include: { bus: { select: { id: true, deletedAt: true } } },
  });
  if (!device?.bus || device.bus.deletedAt) {
    throw new ApiError("GPS device key is not connected to an active vehicle", 401);
  }
  return { id: device.id, busId: device.bus.id };
}

export async function markGpsDeviceSeen(deviceId: string, at = new Date()) {
  await prisma.gpsDevice.update({
    where: { id: deviceId },
    data: { lastSeenAt: at },
  });
}
