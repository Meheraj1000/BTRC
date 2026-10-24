export type BusIssueKind =
  | "OFF_ROUTE"
  | "DEVIATING"
  | "OVERSPEED"
  | "MAINTENANCE"
  | "OFFLINE"
  | "SOS"
  | "COMPLAINT"
  | "ALERT";

export type BusIssueDetail = {
  kind: BusIssueKind;
  label: string;
  summaryKey?: string;
  summaryText?: string;
  status?: string | null;
  count?: number;
};

/** A bus is in trouble when it is off its road, speeding, out of service, or has an open case. */
export function busExperiencingIssue(input: {
  complianceStatus?: string | null;
  operationalStatus?: string | null;
  speed?: number | null;
  allowedSpeed?: number | null;
  overspeedMargin?: number;
  openCase?: boolean;
}): boolean {
  if (input.openCase) return true;
  if (input.complianceStatus === "OFF_ROUTE" || input.complianceStatus === "DEVIATING") return true;
  if (input.operationalStatus === "MAINTENANCE" || input.operationalStatus === "OFFLINE") return true;
  if (input.allowedSpeed != null && input.speed != null && input.speed > input.allowedSpeed + (input.overspeedMargin ?? 0)) {
    return true;
  }
  return false;
}

/** Live conditions that are visible without opening a case record. */
export function conditionIssues(input: {
  complianceStatus?: string | null;
  operationalStatus?: string | null;
  speed?: number | null;
  allowedSpeed?: number | null;
  overspeedMargin?: number;
  deviationM?: number | null;
}): BusIssueDetail[] {
  const issues: BusIssueDetail[] = [];
  const meters = input.deviationM == null ? undefined : `${Math.round(input.deviationM)} m`;
  if (input.complianceStatus === "OFF_ROUTE") {
    issues.push({
      kind: "OFF_ROUTE",
      label: "Off route",
      summaryKey: "The vehicle is outside its assigned road.",
      summaryText: meters,
    });
  }
  if (input.complianceStatus === "DEVIATING") {
    issues.push({
      kind: "DEVIATING",
      label: "Route drift",
      summaryKey: "The vehicle is leaving its assigned road.",
      summaryText: meters,
    });
  }
  if (input.operationalStatus === "MAINTENANCE") {
    issues.push({
      kind: "MAINTENANCE",
      label: "Marked in maintenance",
      summaryKey: "This vehicle is marked in maintenance.",
    });
  }
  if (input.operationalStatus === "OFFLINE") {
    issues.push({
      kind: "OFFLINE",
      label: "Marked offline",
      summaryKey: "This vehicle is marked offline.",
    });
  }
  if (
    input.allowedSpeed != null
    && input.speed != null
    && input.speed > input.allowedSpeed + (input.overspeedMargin ?? 0)
  ) {
    issues.push({
      kind: "OVERSPEED",
      label: "Overspeed",
      summaryKey: "Current speed is above the route limit.",
      summaryText: `${Math.round(input.speed)} km/h`,
    });
  }
  return issues;
}
