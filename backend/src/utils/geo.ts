export type LatLng = { lat: number; lng: number };

export function isValidLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

const R = 6371000;

export function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pointToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const toXY = (pt: LatLng, origin: LatLng) => {
    const x = toRad(pt.lng - origin.lng) * Math.cos(toRad(origin.lat)) * R;
    const y = toRad(pt.lat - origin.lat) * R;
    return { x, y };
  };
  const pa = toXY(p, a);
  const ba = toXY(b, a);
  const len2 = ba.x * ba.x + ba.y * ba.y;
  if (len2 === 0) return haversineMeters(p, a);
  let t = (pa.x * ba.x + pa.y * ba.y) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
  return haversineMeters(p, proj);
}

export function distanceToPolylineMeters(point: LatLng, line: LatLng[]): number {
  if (line.length === 0) return Number.POSITIVE_INFINITY;
  if (line.length === 1) return haversineMeters(point, line[0]);
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < line.length - 1; i += 1) {
    min = Math.min(min, pointToSegmentMeters(point, line[i], line[i + 1]));
  }
  return min;
}

export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export function bearingDegrees(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

export function parsePolyline(raw: unknown): LatLng[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (Array.isArray(p) && p.length >= 2) return { lat: Number(p[0]), lng: Number(p[1]) };
      if (p && typeof p === "object" && "lat" in p && "lng" in p) {
        return { lat: Number((p as LatLng).lat), lng: Number((p as LatLng).lng) };
      }
      return null;
    })
    .filter((p): p is LatLng => p !== null && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

export function remainingDistanceKm(point: LatLng, line: LatLng[]): number {
  if (line.length < 2) return 0;
  let closestIdx = 0;
  let closest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < line.length; i += 1) {
    const d = haversineMeters(point, line[i]);
    if (d < closest) {
      closest = d;
      closestIdx = i;
    }
  }
  let meters = 0;
  for (let i = closestIdx; i < line.length - 1; i += 1) {
    meters += haversineMeters(line[i], line[i + 1]);
  }
  return meters / 1000;
}

export function ruleBasedEtaMinutes(distanceKm: number, speedKmh: number, hour: number): number {
  const speed = Math.max(8, speedKmh || 20);
  let congestion = 1;
  if (hour >= 7 && hour <= 10) congestion = 1.45;
  else if (hour >= 16 && hour <= 20) congestion = 1.55;
  else if (hour >= 12 && hour <= 14) congestion = 1.15;
  return Math.round(((distanceKm / speed) * 60 * congestion) * 10) / 10;
}
