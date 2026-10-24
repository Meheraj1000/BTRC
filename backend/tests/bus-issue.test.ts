import { describe, expect, it } from "vitest";
import { busExperiencingIssue } from "../src/utils/busIssue.js";

describe("busExperiencingIssue", () => {
  it("stays clear while the bus is on route and in service", () => {
    expect(busExperiencingIssue({
      complianceStatus: "ON_ROUTE",
      operationalStatus: "ACTIVE",
      speed: 36,
      allowedSpeed: 40,
    })).toBe(false);
    expect(busExperiencingIssue({ complianceStatus: "NEAR_ROUTE", operationalStatus: "ACTIVE" })).toBe(false);
  });

  it("flags route, speed, service, and open cases", () => {
    expect(busExperiencingIssue({ complianceStatus: "OFF_ROUTE" })).toBe(true);
    expect(busExperiencingIssue({ complianceStatus: "DEVIATING" })).toBe(true);
    expect(busExperiencingIssue({ operationalStatus: "MAINTENANCE" })).toBe(true);
    expect(busExperiencingIssue({ operationalStatus: "OFFLINE" })).toBe(true);
    expect(busExperiencingIssue({ speed: 55, allowedSpeed: 40, overspeedMargin: 5 })).toBe(true);
    expect(busExperiencingIssue({ speed: 45, allowedSpeed: 40, overspeedMargin: 5 })).toBe(false);
    expect(busExperiencingIssue({ complianceStatus: "ON_ROUTE", openCase: true })).toBe(true);
  });
});
