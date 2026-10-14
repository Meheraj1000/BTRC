import { env } from "../config/env.js";
import { ApiError } from "../lib/apiResponse.js";
import { haversineMeters } from "./geo.js";

export type TrackingState = "ONLINE" | "STALE";

export function parseGpsTimestamp(value?: string) {
  if (!value) return new Date();
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new ApiError("Invalid GPS timestamp", 422);
  }
  const now = Date.now();
  if (timestamp.getTime() > now + env.GPS_TIMESTAMP_FUTURE_SEC * 1000) {
    throw new ApiError("GPS timestamp is too far in the future", 422);
  }
  if (timestamp.getTime() < now - env.GPS_TIMESTAMP_PAST_HOURS * 60 * 60 * 1000) {
    throw new ApiError("GPS timestamp is too old", 422);
  }
  return timestamp;
}

export function assertGpsJump(
  previous: { latitude: unknown; longitude: unknown; timestamp: Date } | null,
  next: { latitude: number; longitude: number; timestamp: Date },
) {
  if (!previous) return;
  const ageMs = next.timestamp.getTime() - new Date(previous.timestamp).getTime();
  if (ageMs > 60 * 60 * 1000) return;
  const meters = haversineMeters(
    { lat: Number(previous.latitude), lng: Number(previous.longitude) },
    { lat: next.latitude, lng: next.longitude },
  );
  if (meters > env.GPS_MAX_JUMP_KM * 1000) {
    throw new ApiError("Unrealistic GPS jump rejected", 422);
  }
}

export function trackingState(timestamp: Date | string, now = Date.now()): TrackingState {
  const ms = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return "STALE";
  return now - ms <= env.GPS_STALE_SECONDS * 1000 ? "ONLINE" : "STALE";
}

export function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
