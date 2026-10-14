import type { RouteComplianceStatus } from "@prisma/client";

export type DistanceClass = "ON_ROUTE" | "NEAR_ROUTE" | "DEVIATING";

export type ComplianceThresholds = {
  nearMeters: number;
  offMeters: number;
  consecutiveOff: number;
  consecutiveOn: number;
};

export type ComplianceSnapshot = {
  status: RouteComplianceStatus;
  consecutiveOff: number;
  consecutiveOn: number;
};

export function classifyDistance(deviationM: number, thresholds: Pick<ComplianceThresholds, "nearMeters" | "offMeters">): DistanceClass {
  if (deviationM <= thresholds.nearMeters) return "ON_ROUTE";
  if (deviationM <= thresholds.offMeters) return "NEAR_ROUTE";
  return "DEVIATING";
}

export function nextComplianceState(
  previous: ComplianceSnapshot | null,
  sample: DistanceClass,
  thresholds: ComplianceThresholds,
): ComplianceSnapshot {
  const prev = previous ?? { status: "UNASSIGNED" as RouteComplianceStatus, consecutiveOff: 0, consecutiveOn: 0 };

  if (sample === "DEVIATING") {
    const consecutiveOff = prev.consecutiveOff + 1;
    const status: RouteComplianceStatus = consecutiveOff >= thresholds.consecutiveOff ? "OFF_ROUTE" : "DEVIATING";
    return { status, consecutiveOff, consecutiveOn: 0 };
  }

  const consecutiveOn = prev.consecutiveOn + 1;
  const recovering = prev.status === "DEVIATING" || prev.status === "OFF_ROUTE";
  if (recovering && consecutiveOn < thresholds.consecutiveOn) {
    return { status: prev.status, consecutiveOff: 0, consecutiveOn };
  }
  return { status: sample, consecutiveOff: 0, consecutiveOn };
}

export function complianceTransitioned(from: RouteComplianceStatus, to: RouteComplianceStatus) {
  return from !== to;
}
