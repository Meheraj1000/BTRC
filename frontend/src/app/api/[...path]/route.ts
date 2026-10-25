import { NextRequest } from "next/server";
import { proxyUpstream } from "@/lib/upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { path: string[] } };

function forward(req: NextRequest, ctx: Ctx) {
  const path = ctx.params.path.map(encodeURIComponent).join("/");
  return proxyUpstream(req, `/api/${path}`);
}

export function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export function PUT(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export function PATCH(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export function DELETE(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
export function OPTIONS(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx);
}
