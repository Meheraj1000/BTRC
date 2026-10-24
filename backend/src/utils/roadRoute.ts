import { distanceToPolylineMeters, type LatLng } from "./geo.js";

const OSRM = "https://router.project-osrm.org/route/v1/driving";

/**
 * Thin a stored corridor down to the waypoints Leaflet Routing / OSRM should follow.
 * Short demo routes pass through unchanged. Very dense lines are sampled so the
 * public router URL stays within limits.
 */
export function routingWaypoints(points: LatLng[], max = 18): LatLng[] {
  if (points.length <= 2 || points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]!);
  out[0] = points[0]!;
  out[out.length - 1] = points[points.length - 1]!;
  return out;
}

function cacheKey(points: LatLng[]) {
  return points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";");
}

const cache = new Map<string, { line: LatLng[] | null; at: number }>();

/** Road geometry from the same OSRM service Leaflet Routing Machine uses. */
export async function roadPolyline(waypoints: LatLng[]): Promise<LatLng[] | null> {
  if (waypoints.length < 2 || process.env.VITEST) return null;
  const key = cacheKey(waypoints);
  const hit = cache.get(key);
  const ttl = hit?.line ? 6 * 60 * 60 * 1000 : 60 * 1000;
  if (hit && Date.now() - hit.at < ttl) return hit.line;
  try {
    const path = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `${OSRM}/${path}?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
    };
    const line = (json.routes?.[0]?.geometry?.coordinates ?? [])
      .map(([lng, lat]) => ({ lat, lng }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const ok = line.length >= 2 ? line : null;
    cache.set(key, { line: ok, at: Date.now() });
    return ok;
  } catch {
    cache.set(key, { line: null, at: Date.now() });
    return null;
  }
}

/**
 * Points already near the stored corridor keep that measurement (tests and
 * on-chord samples). Points far from the straight corridor are measured
 * against the road, so a bus following the street is not treated as off-route.
 */
export async function deviationAgainstRoad(point: LatLng, stored: LatLng[], chordMeters: number, offMeters: number) {
  if (!Number.isFinite(chordMeters) || chordMeters <= offMeters || stored.length < 2) return chordMeters;
  const road = await roadPolyline(routingWaypoints(stored));
  if (!road) return chordMeters;
  return Math.min(chordMeters, distanceToPolylineMeters(point, road));
}
