import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const ACTIVE_SOS = ["OPEN", "ACKNOWLEDGED", "DISPATCHED", "INVESTIGATING", "RESPONDING"] as const;
const OPEN_ALERT = ["OPEN", "ACKNOWLEDGED"] as const;
const OPEN_COMPLAINT = ["PENDING", "UNDER_REVIEW"] as const;

const TTL_MS = 4000;
let cached: { at: number; ids: Set<string> } | null = null;

/** Bus ids with an unresolved alert, SOS, or complaint. */
export async function openIssueBusIds(db: PrismaClient = prisma): Promise<Set<string>> {
  if (!process.env.VITEST && cached && Date.now() - cached.at < TTL_MS) return cached.ids;
  const [alerts, sos, complaints] = await Promise.all([
    db.alert.findMany({
      where: { status: { in: [...OPEN_ALERT] }, busId: { not: null } },
      select: { busId: true },
    }),
    db.sosRequest.findMany({
      where: { status: { in: [...ACTIVE_SOS] }, busId: { not: null } },
      select: { busId: true },
    }),
    db.complaint.findMany({
      where: { status: { in: [...OPEN_COMPLAINT] }, busId: { not: null } },
      select: { busId: true },
    }),
  ]);
  const ids = new Set<string>();
  for (const row of [...alerts, ...sos, ...complaints]) {
    if (row.busId) ids.add(row.busId);
  }
  cached = { at: Date.now(), ids };
  return ids;
}
