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
  cursor: number;
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
    buses.push({
      busId: bus.id,
      deviceId: bus.gpsDeviceId,
      routeId: bus.routeId ?? undefined,
      driverId: bus.driverId ?? undefined,
      polyline: poly,
      cursor: Math.random() * (poly.length - 1),
      dir: Math.random() > 0.5 ? 1 : -1,
      speed: 18 + Math.random() * 16,
    });
  }

  console.log(`[SIMULATOR] Development GPS simulator started for ${buses.length} buses.`);
  console.log("[SIMULATOR] Data source label: SIMULATION. Not live government GPS.");
  console.log("[SIMULATOR] Commands via stdin: stop | start | overspeed | deviate | emergency | help");
}

async function tick() {
  if (!running) return;
  for (const bus of buses) {
    const max = bus.polyline.length - 1;
    bus.cursor += bus.dir * (0.08 + Math.random() * 0.12);
    if (bus.cursor >= max) {
      bus.cursor = max;
      bus.dir = -1;
    }
    if (bus.cursor <= 0) {
      bus.cursor = 0;
      bus.dir = 1;
    }
    const i = Math.floor(bus.cursor);
    const t = bus.cursor - i;
    const a = bus.polyline[i];
    const b = bus.polyline[Math.min(i + 1, max)];
    let point = interpolate(a, b, t);
    if (bus.deviate) {
      point = { lat: point.lat + 0.012, lng: point.lng + 0.012 };
    }
    const speed = bus.overspeed ? 72 + Math.random() * 12 : jitter(bus.speed, 6);
    const heading = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI + 360;
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
  const i = Math.floor(first.cursor);
  const p = first.polyline[i];
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
