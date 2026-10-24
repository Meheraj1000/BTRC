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
