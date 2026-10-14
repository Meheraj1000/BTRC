import { describe, expect, it } from "vitest";
import { classifyDistance, nextComplianceState } from "../src/utils/routeCompliance.js";

const thresholds = { nearMeters: 100, offMeters: 250, consecutiveOff: 3, consecutiveOn: 2 };

describe("route compliance rules", () => {
  it("classifies on-route, near-route, and deviation distances", () => {
    expect(classifyDistance(20, thresholds)).toBe("ON_ROUTE");
    expect(classifyDistance(180, thresholds)).toBe("NEAR_ROUTE");
    expect(classifyDistance(400, thresholds)).toBe("DEVIATING");
  });

  it("does not mark OFF_ROUTE from a single noisy point", () => {
    const first = nextComplianceState(null, "DEVIATING", thresholds);
    expect(first.status).toBe("DEVIATING");
    const second = nextComplianceState(first, "DEVIATING", thresholds);
    expect(second.status).toBe("DEVIATING");
    const third = nextComplianceState(second, "DEVIATING", thresholds);
    expect(third.status).toBe("OFF_ROUTE");
  });

  it("requires consecutive on-route samples before returning from OFF_ROUTE", () => {
    const off = { status: "OFF_ROUTE" as const, consecutiveOff: 3, consecutiveOn: 0 };
    const one = nextComplianceState(off, "ON_ROUTE", thresholds);
    expect(one.status).toBe("OFF_ROUTE");
    const two = nextComplianceState(one, "ON_ROUTE", thresholds);
    expect(two.status).toBe("ON_ROUTE");
  });
});
