import type { RoleCode } from "./types";
import { primaryRole } from "./nav";

export function notificationsPathFor(roles: RoleCode[]) {
  const role = primaryRole(roles);
  const map: Record<string, string> = {
    SUPER_ADMIN: "/admin/notifications",
    GOVERNMENT: "/government/notifications",
    POLICE: "/police/notifications",
    BRTA: "/brta/notifications",
    TRANSPORT_OWNER: "/owner/notifications",
    DRIVER: "/driver/notifications",
    PASSENGER: "/passenger/notifications",
  };
  return map[role] ?? "/passenger/notifications";
}

export function isEmergencyNotice(n: {
  type?: string | null;
  title?: string | null;
  body?: string | null;
  payload?: unknown;
}) {
  const type = String(n.type ?? "").toUpperCase();
  const title = String(n.title ?? "").toLowerCase();
  const body = String(n.body ?? "").toLowerCase();
  const payload = n.payload && typeof n.payload === "object" ? (n.payload as Record<string, unknown>) : {};
  const source = String(payload.source ?? "").toUpperCase();
  if (type === "SOS") return true;
  if (source === "QR_EMERGENCY") return true;
  if (title.includes("emergency") || title.includes("sos") || title.includes("qr emergency")) return true;
  if (body.includes("qr emergency") || body.includes("critical qr")) return true;
  return false;
}

export function isEmergencyComplaint(c: {
  priority?: string | null;
  category?: string | null;
  subject?: string | null;
  description?: string | null;
  reference?: string | null;
}) {
  const priority = String(c.priority ?? "").toUpperCase();
  const category = String(c.category ?? "").toUpperCase();
  const subject = String(c.subject ?? "").toLowerCase();
  const description = String(c.description ?? "").toLowerCase();
  const reference = String(c.reference ?? "").toUpperCase();
  if (priority === "CRITICAL" || priority === "HIGH") return true;
  if (category === "HARASSMENT_SECURITY" || category === "SAFETY_CONCERN") return true;
  if (reference.startsWith("EMG-")) return true;
  if (subject.includes("emergency") || subject.includes("sos")) return true;
  if (description.includes("qr emergency") || description.includes("emergency sos")) return true;
  return false;
}
