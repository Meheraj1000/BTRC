import type { RoleCode } from "@prisma/client";
import type { Request } from "express";
import { ApiError } from "../lib/apiResponse.js";
import { prisma } from "../lib/prisma.js";

const NATIONAL_ROLES: RoleCode[] = ["SUPER_ADMIN", "GOVERNMENT"];

export const PLACE_BOXES: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  Dhaka: { minLat: 23.55, maxLat: 24.15, minLng: 90.15, maxLng: 90.65 },
  Chattogram: { minLat: 22.15, maxLat: 22.6, minLng: 91.7, maxLng: 92.05 },
  Sylhet: { minLat: 24.8, maxLat: 25.05, minLng: 91.75, maxLng: 92 },
  Rajshahi: { minLat: 24.3, maxLat: 24.5, minLng: 88.5, maxLng: 88.7 },
  Khulna: { minLat: 22.75, maxLat: 22.95, minLng: 89.45, maxLng: 89.7 },
};

const NONE = "00000000-0000-0000-0000-000000000000";

export function canonicalCity(value: string) {
  const trimmed = value.trim();
  return Object.keys(PLACE_BOXES).find((city) => city.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}

export function cityForPoint(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  for (const [city, box] of Object.entries(PLACE_BOXES)) {
    if (latitude >= box.minLat && latitude <= box.maxLat && longitude >= box.minLng && longitude <= box.maxLng) {
      return city;
    }
  }
  return null;
}

export function isPlaceScopedPolice(roles: readonly string[] | undefined) {
  if (!roles?.includes("POLICE")) return false;
  return !roles.some((role) => (NATIONAL_ROLES as readonly string[]).includes(role));
}

/** Null means this caller is not limited to a police place. */
export async function policeCityScope(req: Request): Promise<string[] | null> {
  if (!req.user || !isPlaceScopedPolice(req.user.roles)) return null;
  const rows = await prisma.policeArea.findMany({
    where: { userId: req.user.id },
    select: { city: true },
    orderBy: { city: "asc" },
  });
  return rows.map((row) => canonicalCity(row.city));
}

export function busPlaceWhere(cities: string[]) {
  if (cities.length === 0) return { id: NONE };
  return {
    OR: [
      { route: { is: { city: { in: cities, mode: "insensitive" as const } } } },
      { AND: [{ routeId: null }, { company: { is: { city: { in: cities, mode: "insensitive" as const } } } }] },
    ],
  };
}

export function routePlaceWhere(cities: string[]) {
  if (cities.length === 0) return { id: NONE };
  return { city: { in: cities, mode: "insensitive" as const } };
}

export function driverPlaceWhere(cities: string[]) {
  if (cities.length === 0) return { id: NONE };
  return { buses: { some: { deletedAt: null, AND: [busPlaceWhere(cities)] } } };
}

/** Alerts, SOS, complaints, and lost-and-found rows tied to a bus, route, or coordinate box. */
export function placeRecordFilter(cities: string[]) {
  if (cities.length === 0) return { id: NONE };
  return {
    OR: [
      { bus: { is: busPlaceWhere(cities) } },
      { route: { is: { city: { in: cities, mode: "insensitive" as const } } } },
      ...pointClauses(cities),
    ],
  };
}

/** Records that have a bus and coordinates, but no route relation (accidents). */
export function placeBusOrPointFilter(cities: string[]) {
  if (cities.length === 0) return { id: NONE };
  return {
    OR: [
      { bus: { is: busPlaceWhere(cities) } },
      ...pointClauses(cities),
    ],
  };
}

function pointClauses(cities: string[]) {
  return cities.flatMap((city) => {
    const box = PLACE_BOXES[canonicalCity(city)];
    if (!box) return [];
    return [{
      busId: null,
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
    }];
  });
}

type PlaceSubject = {
  busId?: string | null;
  routeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function resolvePlace(subject: PlaceSubject) {
  if (subject.busId) {
    const bus = await prisma.bus.findUnique({
      where: { id: subject.busId },
      select: { routeId: true, route: { select: { city: true } }, company: { select: { city: true } } },
    });
    if (bus?.route?.city) return canonicalCity(bus.route.city);
    if (bus && !bus.routeId && bus.company?.city) return canonicalCity(bus.company.city);
  }
  if (subject.routeId) {
    const route = await prisma.route.findUnique({ where: { id: subject.routeId }, select: { city: true } });
    if (route?.city) return canonicalCity(route.city);
  }
  return cityForPoint(subject.latitude, subject.longitude);
}

export async function assertPolicePlace(req: Request, subject: PlaceSubject) {
  const cities = await policeCityScope(req);
  if (!cities) return;
  const place = await resolvePlace(subject);
  if (!place || !cities.some((city) => city.toLowerCase() === place.toLowerCase())) {
    throw new ApiError("This problem is outside your assigned place", 403);
  }
}

export async function cityFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as { busId?: unknown; routeId?: unknown; city?: unknown; latitude?: unknown; longitude?: unknown };
  if (typeof row.city === "string" && row.city.trim()) return canonicalCity(row.city);
  return resolvePlace({
    busId: typeof row.busId === "string" ? row.busId : null,
    routeId: typeof row.routeId === "string" ? row.routeId : null,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
  });
}
