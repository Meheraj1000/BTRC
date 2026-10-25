import type { CameraStatus, StreetCamera } from "@prisma/client";
import type { Request } from "express";
import { DEMO_CAMERAS } from "../data/demoCameras.js";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";
import { canonicalCity, policeCityScope } from "../utils/policeArea.js";

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
