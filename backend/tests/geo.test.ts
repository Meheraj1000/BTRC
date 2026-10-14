import { describe, expect, it } from "vitest";
import { distanceToPolylineMeters, haversineMeters, remainingDistanceKm, ruleBasedEtaMinutes } from "../src/utils/geo.js";

describe("geo utilities", () => {
  it("computes Dhaka-scale haversine distance", () => {
    const motijheel = { lat: 23.733, lng: 90.4172 };
    const farmgate = { lat: 23.7563, lng: 90.39 };
    const d = haversineMeters(motijheel, farmgate);
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(8000);
  });

  it("treats a point on the polyline as on-route", () => {
    const line = [
      { lat: 23.73, lng: 90.41 },
      { lat: 23.75, lng: 90.40 },
      { lat: 23.77, lng: 90.39 },
    ];
    const d = distanceToPolylineMeters({ lat: 23.75, lng: 90.40 }, line);
    expect(d).toBeLessThan(5);
  });

  it("detects a large route deviation", () => {
    const line = [
      { lat: 23.73, lng: 90.41 },
      { lat: 23.75, lng: 90.40 },
    ];
    const d = distanceToPolylineMeters({ lat: 23.80, lng: 90.50 }, line);
    expect(d).toBeGreaterThan(250);
  });

  it("returns a positive rule-based ETA", () => {
    const eta = ruleBasedEtaMinutes(8, 20, 8);
    expect(eta).toBeGreaterThan(20);
    const remaining = remainingDistanceKm({ lat: 23.73, lng: 90.41 }, [
      { lat: 23.73, lng: 90.41 },
      { lat: 23.80, lng: 90.38 },
    ]);
    expect(remaining).toBeGreaterThan(0);
  });
});
