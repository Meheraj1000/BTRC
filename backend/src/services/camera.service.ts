import type { AlertType, CameraStatus, StreetCamera } from "@prisma/client";
import type { Request } from "express";
import { DEMO_CAMERAS } from "../data/demoCameras.js";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { busPlaceWhere, canonicalCity, cityForPoint, policeCityScope } from "../utils/policeArea.js";

const NONE = "00000000-0000-0000-0000-000000000000";

function cameraPlaceWhere(cities: string[]) {
  if (cities.length === 0) return { id: NONE };
  return { city: { in: cities, mode: "insensitive" as const } };
}

function assertPublicHttps(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError("Enter an https stream address", 400);
  }
  if (url.protocol !== "https:") throw new ApiError("Stream address must start with https", 400);
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1") {
    throw new ApiError("Stream address must be a public https address", 400);
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    const privateRange = a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
    if (privateRange) throw new ApiError("Stream address must be a public https address", 400);
  }
}

export function toCamera(row: StreetCamera, includeStream: boolean) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    city: row.city,
    area: row.area,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    source: row.source,
    facing: row.facing,
    streamUrl: includeStream && row.source === "HLS" ? row.streamUrl : null,
    dataLabel: row.source === "HLS" ? "EXTERNAL" : "SIMULATED",
  };
}

export async function listCameras(req: Request, query: { city?: string; status?: CameraStatus }) {
  const cities = await policeCityScope(req);
  const requested = query.city ? canonicalCity(query.city) : null;
  if (cities && requested && !cities.some((city) => city.toLowerCase() === requested.toLowerCase())) {
    return { items: [], total: 0 };
  }
  const where = {
    ...(cities ? cameraPlaceWhere(cities) : {}),
    ...(requested ? { city: { equals: requested, mode: "insensitive" as const } } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const rows = await prisma.streetCamera.findMany({
    where,
    orderBy: [{ city: "asc" }, { code: "asc" }],
  });
  return { items: rows.map((row) => toCamera(row, false)), total: rows.length };
}

export async function getCamera(req: Request, id: string) {
  const row = await prisma.streetCamera.findUnique({ where: { id } });
  if (!row) throw new ApiError("Camera not found", 404);
  const cities = await policeCityScope(req);
  if (cities && !cities.some((city) => city.toLowerCase() === row.city.toLowerCase())) {
    throw new ApiError("This camera is outside your assigned place", 403);
  }
  return toCamera(row, true);
}

export async function updateCamera(
  id: string,
  body: { streamUrl?: string | null; status?: CameraStatus },
) {
  const existing = await prisma.streetCamera.findUnique({ where: { id } });
  if (!existing) throw new ApiError("Camera not found", 404);
  const data: { streamUrl?: string | null; source?: "SIMULATED" | "HLS"; status?: CameraStatus } = {};
  if (body.streamUrl === null || body.streamUrl === "") {
    data.streamUrl = null;
    data.source = "SIMULATED";
  } else if (typeof body.streamUrl === "string") {
    assertPublicHttps(body.streamUrl);
    data.streamUrl = body.streamUrl;
    data.source = "HLS";
  }
  if (body.status) data.status = body.status;
  if (Object.keys(data).length === 0) return toCamera(existing, true);
  const row = await prisma.streetCamera.update({ where: { id }, data });
  return toCamera(row, true);
}

const SUSPICIOUS_ALERTS: AlertType[] = ["OVERSPEED", "ROUTE_DEVIATION", "SOS", "ACCIDENT", "ABNORMAL_DRIVING"];

const REASON_WORD: Record<string, string> = {
  OVERSPEED: "Overspeed",
  ROUTE_DEVIATION: "Route deviation",
  SOS: "SOS",
  ACCIDENT: "Accident",
  ABNORMAL_DRIVING: "Abnormal driving",
};

function plateKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function slotFor(registration: string) {
  const key = plateKey(registration);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % 4;
  return hash;
}

function nearestCamera(cameras: StreetCamera[], city: string, latitude: number | null, longitude: number | null) {
  const rows = cameras.filter((row) => row.city.toLowerCase() === city.toLowerCase());
  const online = rows.filter((row) => row.status === "ONLINE");
  const pool = online.length > 0 ? online : rows;
  if (pool.length === 0) return null;
  if (latitude == null || longitude == null) return pool[0];
  return [...pool].sort((a, b) => {
    const left = (a.latitude - latitude) ** 2 + (a.longitude - longitude) ** 2;
    const right = (b.latitude - latitude) ** 2 + (b.longitude - longitude) ** 2;
    return left - right;
  })[0];
}

const busDetail = {
  id: true,
  registrationNo: true,
  route: { select: { city: true } },
  company: { select: { city: true } },
  latestLoc: { select: { latitude: true, longitude: true } },
  alerts: {
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] as const }, type: { in: SUSPICIOUS_ALERTS } },
    select: { type: true },
    orderBy: { createdAt: "desc" as const },
    take: 4,
  },
};

type LocatedBus = {
  registrationNo: string;
  route: { city: string } | null;
  company: { city: string } | null;
  latestLoc: { latitude: { toString(): string }; longitude: { toString(): string } } | null;
  alerts: { type: AlertType }[];
};

function toSighting(bus: LocatedBus, cameras: StreetCamera[]) {
  const latitude = bus.latestLoc ? Number(bus.latestLoc.latitude) : null;
  const longitude = bus.latestLoc ? Number(bus.latestLoc.longitude) : null;
  const home = canonicalCity(bus.route?.city ?? bus.company?.city ?? "");
  const seenAt = cityForPoint(latitude, longitude);
  const city = seenAt === home ? seenAt : home;
  const camera = nearestCamera(cameras, city, seenAt === city ? latitude : null, seenAt === city ? longitude : null);
  const reasons = [...new Set(bus.alerts.map((alert) => REASON_WORD[alert.type]).filter(Boolean))];
  return {
    registrationNo: bus.registrationNo,
    camera: camera ? toCamera(camera, true) : null,
    slot: slotFor(bus.registrationNo),
    suspicious: reasons.length > 0,
    reasons,
    dataLabel: "SIMULATED" as const,
  };
}

export async function locateVehicle(req: Request, plate: string) {
  const key = plateKey(plate);
  if (key.length < 3) throw new ApiError("Enter a license plate", 400);
  const cities = await policeCityScope(req);
  const candidates = await prisma.bus.findMany({
    where: { deletedAt: null, ...(cities ? { AND: [busPlaceWhere(cities)] } : {}) },
    select: { id: true, registrationNo: true },
  });
  const hit = candidates.find((row) => plateKey(row.registrationNo) === key);
  if (!hit) return { found: false as const, match: null };
  const bus = await prisma.bus.findUnique({ where: { id: hit.id }, select: busDetail });
  if (!bus) return { found: false as const, match: null };
  const cameras = await prisma.streetCamera.findMany();
  return { found: true as const, match: toSighting(bus, cameras) };
}

export async function listMarkedVehicles(req: Request) {
  const cities = await policeCityScope(req);
  const buses = await prisma.bus.findMany({
    where: {
      deletedAt: null,
      alerts: { some: { status: { in: ["OPEN", "ACKNOWLEDGED"] }, type: { in: SUSPICIOUS_ALERTS } } },
      ...(cities ? { AND: [busPlaceWhere(cities)] } : {}),
    },
    select: busDetail,
    orderBy: { registrationNo: "asc" },
    take: 12,
  });
  const cameras = await prisma.streetCamera.findMany();
  return { items: buses.map((bus) => toSighting(bus, cameras)) };
}

export async function ensureDemoCameras() {
  for (const camera of DEMO_CAMERAS) {
    await prisma.streetCamera.upsert({
      where: { code: camera.code },
      create: camera,
      update: {
        name: camera.name,
        city: camera.city,
        area: camera.area,
        latitude: camera.latitude,
        longitude: camera.longitude,
        facing: camera.facing,
      },
    });
  }
}
