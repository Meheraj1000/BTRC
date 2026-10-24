import { describe, expect, it } from "vitest";
import {
  assertNoSensitiveGps,
  canSeeOperationalGps,
  projectGps,
  toOperationalGpsDto,
  toPublicGpsDto,
} from "../src/utils/gpsDto.js";

const sample = {
  busId: "bus-1",
  deviceId: "dev-secret",
  tripId: "trip-1",
  routeId: "route-1",
  driverId: "driver-1",
  latitude: 23.8103,
  longitude: 90.4125,
  speed: 32,
  heading: 90,
  timestamp: new Date("2026-09-05T10:00:00.000Z"),
  source: "SIMULATION",
  statusColor: "GREEN" as const,
  registrationNo: "DHAKA-METRO-GA-11-1234",
  bus: {
    registrationNo: "DHAKA-METRO-GA-11-1234",
    operationalStatus: "ACTIVE",
    routeId: "route-1",
    driverId: "driver-1",
    companyId: "company-1",
    route: { name: "Gabtoli–Motijheel", allowedSpeed: 40 },
  },
};

describe("GPS DTOs", () => {
  it("strips operational fields from the public projection", () => {
    const dto = toPublicGpsDto(sample);
    expect(dto.projection).toBe("PUBLIC");
    expect(dto.busId).toBe("bus-1");
    expect(dto.latitude).toBe(23.8103);
    expect(dto.dataLabel).toBe("SIMULATED");
    expect(assertNoSensitiveGps(dto as unknown as Record<string, unknown>)).toBe(true);
    expect(dto).not.toHaveProperty("deviceId");
    expect(dto).not.toHaveProperty("driverId");
    expect(dto).not.toHaveProperty("tripId");
    expect(dto).not.toHaveProperty("companyId");
    expect(dto).toHaveProperty("trackingState");
    expect(dto.hasIssue).toBe(false);
  });

  it("includes operational fields only for authorized roles", () => {
    const ops = toOperationalGpsDto(sample);
    expect(ops.projection).toBe("OPERATIONAL");
    expect(ops.deviceId).toBe("dev-secret");
    expect(ops.driverId).toBe("driver-1");
    expect(ops.companyId).toBe("company-1");
    expect(projectGps(sample, ["PASSENGER"]).projection).toBe("PUBLIC");
    expect(projectGps(sample, ["DRIVER"]).projection).toBe("PUBLIC");
    expect(projectGps(sample, ["POLICE"]).projection).toBe("OPERATIONAL");
    expect(projectGps(sample, ["SUPER_ADMIN"]).projection).toBe("OPERATIONAL");
  });

  it("does not grant operational GPS to unauthenticated callers", () => {
    expect(canSeeOperationalGps(undefined)).toBe(false);
    expect(canSeeOperationalGps([])).toBe(false);
    expect(canSeeOperationalGps(["PASSENGER"])).toBe(false);
  });
});
