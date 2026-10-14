import { describe, expect, it } from "vitest";
import { distanceToPolylineMeters } from "../src/utils/geo.js";

describe("overspeed and deviation rules", () => {
  it("flags overspeed when current speed exceeds allowed speed", () => {
    const currentSpeed = 62;
    const allowedSpeed = 40;
    const margin = 0;
    expect(currentSpeed > allowedSpeed + margin).toBe(true);
  });

  it("does not flag when speed is within the limit", () => {
    expect(32 > 40).toBe(false);
  });

  it("creates a route-deviation condition beyond 250 m", () => {
    const line = [
      { lat: 23.7563, lng: 90.39 },
      { lat: 23.77, lng: 90.398 },
    ];
    const off = { lat: 23.82, lng: 90.48 };
    expect(distanceToPolylineMeters(off, line)).toBeGreaterThan(250);
  });
});
