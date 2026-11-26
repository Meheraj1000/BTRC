const STATUS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  MAINTENANCE: "In maintenance",
  OFFLINE: "Offline",
  ONLINE: "Location is current",
  STALE: "Location is out of date",
  ON_ROUTE: "On the route",
  NEAR_ROUTE: "Near the route",
  DEVIATING: "Off the route",
  OFF_ROUTE: "Left the route",
  RETURNED: "Back on the route",
  PENDING: "Waiting for review",
  VALID: "Valid",
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
  FIT: "Fit to run",
  UNFIT: "Not fit to run",
  OPEN: "Open",
  ACKNOWLEDGED: "Seen",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export function statusLabel(code: string | null | undefined) {
  if (!code) return "";
  if (STATUS[code]) return STATUS[code];
  const words = code.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
