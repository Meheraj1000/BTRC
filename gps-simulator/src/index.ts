import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

/**
 * Nirapad Transit GPS Simulator
 * -----------------------------
 * DEVELOPMENT / TEST ONLY.
 * This process posts synthetic locations to POST /api/gps/location.
 * It is not a government feed and not a physical GPS device.
 */

type Point = { lat: number; lng: number };
type BusState = {
  busId: string;
  deviceId?: string;
  routeId?: string;
  driverId?: string;
  tripId?: string;
  polyline: Point[];
  cum: number[];
  total: number;
  meters: number;
  dir: 1 | -1;
  speed: number;
  overspeed?: boolean;
  deviate?: boolean;
};

const API = process.env.SIMULATOR_API_URL ?? "http://localhost:4000/api";
const INTERVAL = Number(process.env.SIMULATOR_INTERVAL_MS ?? 2000);
const EMAIL = process.env.SIMULATOR_EMAIL ?? "admin@nirapad.gov.bd";
const PASSWORD = process.env.SIMULATOR_PASSWORD ?? "Demo@12345";

let token = "";
let running = true;
const buses: BusState[] = [];

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json() as { success: boolean; data?: { accessToken: string }; message?: string };
  if (!json.success || !json.data?.accessToken) {
    throw new Error(`Simulator login failed: ${json.message ?? res.status}`);
  }
  token = json.data.accessToken;
}

async function api(pathName: string, init?: RequestInit) {
  const res = await fetch(`${API}${pathName}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  return res.json() as Promise<{ success: boolean; data: unknown; message?: string }>;
}

function interpolate(a: Point, b: Point, t: number): Point {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function haversineMeters(a: Point, b: Point) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Same thinning as the map's Leaflet Routing waypoints. */
function routingWaypoints(points: Point[], max = 18): Point[] {
  if (points.length <= 2 || points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: Point[] = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]!);
  out[0] = points[0]!;
  out[out.length - 1] = points[points.length - 1]!;
  return out;
}

function buildPath(points: Point[]) {
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) {
    cum.push(cum[i - 1]! + haversineMeters(points[i - 1]!, points[i]!));
  }
  return { points, cum, total: cum[cum.length - 1] ?? 0 };
}

function pointAlong(bus: BusState, meters: number) {
  const m = Math.max(0, Math.min(bus.total, meters));
  let i = 1;
  while (i < bus.cum.length && bus.cum[i]! < m) i += 1;
  const i0 = Math.max(0, i - 1);
  const i1 = Math.min(bus.polyline.length - 1, i);
  const span = (bus.cum[i1] ?? 0) - (bus.cum[i0] ?? 0) || 1;
  const t = (m - (bus.cum[i0] ?? 0)) / span;
  const a = bus.polyline[i0]!;
  const b = bus.polyline[i1]!;
  const heading = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
  return { point: interpolate(a, b, Math.max(0, Math.min(1, t))), heading };
}

/**
 * Road geometry from the OSRM service Leaflet Routing Machine uses
 * (https://router.project-osrm.org). Falls back to the stored corridor.
 */
async function roadGeometry(points: Point[]): Promise<Point[]> {
  const waypoints = routingWaypoints(points);
  if (waypoints.length < 2) return points;
  try {
    const path = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
    };
    const line = (json.routes?.[0]?.geometry?.coordinates ?? [])
      .map(([lng, lat]) => ({ lat, lng }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    return line.length >= 2 ? line : points;
  } catch (err) {
    console.error("[SIMULATOR] road route failed, using straight waypoints", err);
    return points;
  }
}

function jitter(n: number, amount: number) {
  return n + (Math.random() - 0.5) * amount;
}

async function bootstrap() {
  await login();
  const list = await api("/buses?pageSize=100");
  const routesRes = await api("/routes");
  const items = (list.data as { items?: Array<{
    id: string;
    gpsDeviceId?: string;
    routeId?: string | null;
    driverId?: string | null;
    route?: { polyline?: Point[] };
  }> })?.items ?? [];
  const routes = (Array.isArray(routesRes.data) ? routesRes.data : []) as Array<{
    id: string;
    polyline?: Point[];
  }>;
  const polylineByRoute = new Map(routes.map((r) => [r.id, r.polyline ?? []]));

  if (!items.length) {
    console.error("[SIMULATOR] No buses found. Seed the database first.");
    process.exit(1);
  }

  for (const bus of items) {
    const poly = (bus.route?.polyline ?? (bus.routeId ? polylineByRoute.get(bus.routeId) : undefined) ?? []) as Point[];
    if (poly.length < 2) continue;
    const road = await roadGeometry(poly);
    const path = buildPath(road);
    if (path.total < 1) continue;
    buses.push({
      busId: bus.id,
      deviceId: bus.gpsDeviceId,
      routeId: bus.routeId ?? undefined,
      driverId: bus.driverId ?? undefined,
      polyline: path.points,
      cum: path.cum,
      total: path.total,
      meters: Math.random() * path.total,
      dir: Math.random() > 0.5 ? 1 : -1,
      speed: 18 + Math.random() * 16,
    });
    console.log(`[SIMULATOR] ${bus.id} following road geometry (${road.length} points, ${Math.round(path.total)} m).`);
  }

  console.log(`[SIMULATOR] Development GPS simulator started for ${buses.length} buses.`);
  console.log("[SIMULATOR] Data source label: SIMULATION. Not live government GPS.");
  console.log("[SIMULATOR] Commands via stdin: stop | start | overspeed | deviate | emergency | help");
}

let lastTick = Date.now();

async function tick() {
  const now = Date.now();
  const dt = Math.min(5, Math.max(0.2, (now - lastTick) / 1000));
  lastTick = now;
  if (!running) return;
  for (const bus of buses) {
    const step = (bus.speed * 1000 / 3600) * dt;
    bus.meters += bus.dir * step;
    if (bus.meters >= bus.total) {
      bus.meters = bus.total;
      bus.dir = -1;
    }
    if (bus.meters <= 0) {
      bus.meters = 0;
      bus.dir = 1;
    }
    const along = pointAlong(bus, bus.meters);
    let point = along.point;
    if (bus.deviate) {
      point = { lat: point.lat + 0.012, lng: point.lng + 0.012 };
    }
    const speed = bus.overspeed ? 72 + Math.random() * 12 : jitter(bus.speed, 6);
    const heading = along.heading + 360;
    await api("/gps/location", {
      method: "POST",
      body: JSON.stringify({
        busId: bus.busId,
        deviceId: bus.deviceId,
        latitude: Number(point.lat.toFixed(6)),
        longitude: Number(point.lng.toFixed(6)),
        speed: Math.max(0, Number(speed.toFixed(1))),
        heading: Number((heading % 360).toFixed(1)),
        timestamp: new Date().toISOString(),
        routeId: bus.routeId,
        driverId: bus.driverId,
        tripId: bus.tripId,
        source: "SIMULATION",
      }),
    }).catch((err) => console.error("[SIMULATOR] ingest failed", err));
  }
}

async function triggerEmergency() {
  await login();
  const first = buses[0];
  if (!first) return;
  const p = pointAlong(first, first.meters).point;
  await api("/sos", {
    method: "POST",
    body: JSON.stringify({
      busId: first.busId,
      latitude: p.lat,
      longitude: p.lng,
      message: "SIMULATOR: simulated emergency (not a real incident)",
    }),
  });
  console.log("[SIMULATOR] Simulated SOS posted.");
}

function help() {
  console.log(`
[SIMULATOR] Commands
  stop        pause movement
  start       resume movement
  overspeed   toggle overspeed on first 3 buses
  deviate     toggle route deviation on first bus
  emergency   post a simulated SOS
  help        this message
`);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  const cmd = String(chunk).trim();
  if (cmd === "stop") {
    running = false;
    console.log("[SIMULATOR] paused");
  } else if (cmd === "start") {
    running = true;
    console.log("[SIMULATOR] running");
  } else if (cmd === "overspeed") {
    buses.slice(0, 3).forEach((b) => {
      b.overspeed = !b.overspeed;
    });
    console.log("[SIMULATOR] overspeed toggled on first 3 buses");
  } else if (cmd === "deviate") {
    if (buses[0]) buses[0].deviate = !buses[0].deviate;
    console.log("[SIMULATOR] deviation toggled on first bus");
  } else if (cmd === "emergency") {
    triggerEmergency().catch(console.error);
  } else {
    help();
  }
});

bootstrap()
  .then(() => {
    setInterval(() => {
      tick().catch((err) => console.error(err));
    }, INTERVAL);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
