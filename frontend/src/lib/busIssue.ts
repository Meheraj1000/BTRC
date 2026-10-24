/** True when this live bus should be drawn in red. */
export function busHasIssue(bus: {
  hasIssue?: boolean;
  complianceStatus?: string | null;
  statusColor?: string | null;
  operationalStatus?: string | null;
}): boolean {
  if (bus.hasIssue) return true;
  if (bus.complianceStatus === "OFF_ROUTE" || bus.complianceStatus === "DEVIATING") return true;
  if (bus.statusColor === "RED" || bus.statusColor === "YELLOW") return true;
  if (bus.operationalStatus === "MAINTENANCE" || bus.operationalStatus === "OFFLINE") return true;
  return false;
}
