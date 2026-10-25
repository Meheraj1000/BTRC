import { NextRequest } from "next/server";

export const OFFLINE =
  "The office computer that runs this service is offline. Leave that computer on, then try again.";

let cached: { origin: string; at: number } | null = null;

export async function resolveOrigin() {
  if (cached && Date.now() - cached.at < 4000) return cached.origin;
  const fallback = (process.env.API_ORIGIN ?? "").replace(/\/$/, "");
  const connection = process.env.EDGE_CONFIG;
  if (!connection) return fallback;
  try {
    const endpoint = new URL(connection);
    const token = endpoint.searchParams.get("token") ?? "";
    const itemUrl = `${endpoint.origin}${endpoint.pathname.replace(/\/$/, "")}/item/origin`;
    const res = await fetch(itemUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    if (res.ok) {
      const value = (await res.json()) as unknown;
      if (typeof value === "string" && value.startsWith("https://")) {
        const origin = value.replace(/\/$/, "");
        cached = { origin, at: Date.now() };
        return origin;
      }
    }
  } catch {
    // The last deployed address is still usable when the live record cannot be read.
  }
  return fallback;
}

export async function proxyUpstream(req: NextRequest, basePath: string) {
  const upstream = await resolveOrigin();
  if (!upstream) {
    return Response.json({ success: false, message: OFFLINE, data: null }, { status: 503 });
  }
  const url = new URL(req.url);
  const target = `${upstream}${basePath}${url.search}`;
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const accept = req.headers.get("accept");
  const authorization = req.headers.get("authorization");
  const language = req.headers.get("accept-language");
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (authorization) headers.set("authorization", authorization);
  if (language) headers.set("accept-language", language);
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const real = req.headers.get("x-real-ip")?.trim() ?? "";
  const ip = /^[0-9a-f.:]{3,64}$/i.test(forwarded) ? forwarded : /^[0-9a-f.:]{3,64}$/i.test(real) ? real : "";
  if (ip) headers.set("x-nirapad-client", ip);

  const method = req.method.toUpperCase();
  const init: RequestInit = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") init.body = await req.arrayBuffer();

  try {
    const res = await fetch(target, { ...init, signal: AbortSignal.timeout(20_000) });
    const type = res.headers.get("content-type") ?? "";
    const disposition = res.headers.get("content-disposition");
    const body = await res.arrayBuffer();
    const download = Boolean(disposition) || /csv|pdf|sheet|excel|octet-stream|zip/i.test(type);
    const jsonRoute = basePath.startsWith("/api/");
    if (jsonRoute && !download && (!type.includes("application/json") || body.byteLength === 0)) {
      return Response.json({ success: false, message: OFFLINE, data: null }, { status: 503 });
    }
    const out = new Headers();
    if (type) out.set("content-type", type);
    if (disposition) out.set("content-disposition", disposition);
    out.set("cache-control", "no-store");
    return new Response(body, { status: res.status, headers: out });
  } catch {
    return Response.json({ success: false, message: OFFLINE, data: null }, { status: 503 });
  }
}
