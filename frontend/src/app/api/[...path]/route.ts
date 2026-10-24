import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OFFLINE =
  "The office computer that runs this service is offline. Leave that computer on, then try again.";

function origin() {
  return (process.env.API_ORIGIN ?? "").replace(/\/$/, "");
}

function clientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (/^[0-9a-f.:]{3,64}$/i.test(forwarded)) return forwarded;
  const real = req.headers.get("x-real-ip")?.trim() ?? "";
  if (/^[0-9a-f.:]{3,64}$/i.test(real)) return real;
  return "";
}

async function proxy(req: NextRequest, path: string[]) {
  const upstream = origin();
  if (!upstream) {
    return Response.json({ success: false, message: OFFLINE, data: null }, { status: 503 });
  }

  const url = new URL(req.url);
  const target = `${upstream}/api/${path.map(encodeURIComponent).join("/")}${url.search}`;
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const accept = req.headers.get("accept");
  const authorization = req.headers.get("authorization");
  const language = req.headers.get("accept-language");
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (authorization) headers.set("authorization", authorization);
  if (language) headers.set("accept-language", language);
  const ip = clientIp(req);
  if (ip) headers.set("x-nirapad-client", ip);

  const method = req.method.toUpperCase();
  const init: RequestInit = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const res = await fetch(target, { ...init, signal: AbortSignal.timeout(20_000) });
    const out = new Headers();
    const type = res.headers.get("content-type");
    const disposition = res.headers.get("content-disposition");
    if (type) out.set("content-type", type);
    if (disposition) out.set("content-disposition", disposition);
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return Response.json({ success: false, message: OFFLINE, data: null }, { status: 503 });
  }
}

type Ctx = { params: { path: string[] } };

export function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export function OPTIONS(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
