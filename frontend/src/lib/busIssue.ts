export type BusIssueDetail = {
  kind: string;
  label: string;
  summaryKey?: string;
  summaryText?: string;
  status?: string | null;
  count?: number;
};

/** Shown immediately from the live marker, before the issue request returns. */
export function localIssueDetails(bus: {
  complianceStatus?: string | null;
  operationalStatus?: string | null;
  statusColor?: string | null;
  hasIssue?: boolean;
  speed?: number;
  allowedSpeed?: number | null;
  deviationM?: number;
}): BusIssueDetail[] {
  const issues: BusIssueDetail[] = [];
  const meters = bus.deviationM == null ? undefined : `${Math.round(bus.deviationM)} m`;
  if (bus.complianceStatus === "OFF_ROUTE") {
    issues.push({ kind: "OFF_ROUTE", label: "Off route", summaryKey: "The vehicle is outside its assigned road.", summaryText: meters });
  }
  if (bus.complianceStatus === "DEVIATING") {
    issues.push({ kind: "DEVIATING", label: "Route drift", summaryKey: "The vehicle is leaving its assigned road.", summaryText: meters });
  }
  if (bus.operationalStatus === "MAINTENANCE") {
    issues.push({ kind: "MAINTENANCE", label: "Marked in maintenance", summaryKey: "This vehicle is marked in maintenance." });
  }
  if (bus.operationalStatus === "OFFLINE") {
    issues.push({ kind: "OFFLINE", label: "Marked offline", summaryKey: "This vehicle is marked offline." });
  }
  if (bus.allowedSpeed != null && bus.speed != null && bus.speed > bus.allowedSpeed) {
    issues.push({
      kind: "OVERSPEED",
      label: "Overspeed",
      summaryKey: "Current speed is above the route limit.",
      summaryText: `${Math.round(bus.speed)} km/h`,
    });
  }
  if (!issues.length && (bus.hasIssue || bus.statusColor === "RED" || bus.statusColor === "YELLOW")) {
    issues.push({
      kind: "ALERT",
      label: "Open issue",
      summaryKey: "An alert, SOS, or complaint is still open for this vehicle.",
    });
  }
  return issues;
}

export function resolveIssueHref(bus: { busId: string; registrationNo?: string }, issues: BusIssueDetail[]) {
  const params = new URLSearchParams();
  if (bus.busId) params.set("busId", bus.busId);
  if (bus.registrationNo) params.set("registration", bus.registrationNo);
  const kinds = [...new Set(issues.map((issue) => issue.kind))];
  if (kinds.length) params.set("kinds", kinds.join(","));
  return `/help/resolve-issue?${params.toString()}`;
}

export function vehicleRowHasIssue(
  row: { id: string; complianceStatus?: string | null; operationalStatus?: string | null },
  issueIds: Set<string>,
) {
  return issueIds.has(row.id)
    || row.complianceStatus === "OFF_ROUTE"
    || row.complianceStatus === "DEVIATING"
    || row.operationalStatus === "MAINTENANCE"
    || row.operationalStatus === "OFFLINE";
}

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
