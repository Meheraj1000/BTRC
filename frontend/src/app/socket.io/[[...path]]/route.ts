import { NextRequest } from "next/server";
import { proxyUpstream } from "@/lib/upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { path?: string[] } };

function forward(req: NextRequest, ctx: Ctx) {
  const extra = (ctx.params.path ?? []).map(encodeURIComponent).join("/");
  return proxyUpstream(req, extra ? `/socket.io/${extra}` : "/socket.io/");
}

export function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export function OPTIONS(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
