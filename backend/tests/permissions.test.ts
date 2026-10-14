import { describe, expect, it } from "vitest";
import { hasPermission, ROLE_PERMISSIONS } from "../src/utils/permissions.js";

const TRIP_READ = ["trips.own", "trips.manage", "analytics.read"] as const;

describe("RBAC", () => {
  it("gives super admin every permission", () => {
    expect(hasPermission(["SUPER_ADMIN"], "users.manage")).toBe(true);
    expect(hasPermission(["SUPER_ADMIN"], "simulator.control")).toBe(true);
  });

  it("blocks passengers from admin dashboards", () => {
    expect(hasPermission(["PASSENGER"], "users.manage")).toBe(false);
    expect(hasPermission(["PASSENGER"], "analytics.read")).toBe(false);
    expect(hasPermission(["PASSENGER"], "sos.create")).toBe(true);
    expect(hasPermission(["PASSENGER"], "complaints.create")).toBe(true);
  });

  it("allows police to manage SOS but not users", () => {
    expect(hasPermission(["POLICE"], "sos.manage")).toBe(true);
    expect(hasPermission(["POLICE"], "users.manage")).toBe(false);
  });

  it("keeps BRTA read-oriented except manual vehicle and driver verification", () => {
    expect(hasPermission(["BRTA"], "buses.read")).toBe(true);
    expect(hasPermission(["BRTA"], "buses.manage")).toBe(false);
    expect(hasPermission(["BRTA"], "buses.verify")).toBe(true);
    expect(hasPermission(["BRTA"], "drivers.verify")).toBe(true);
    expect(hasPermission(["BRTA"], "drivers.manage")).toBe(false);
    expect(hasPermission(["TRANSPORT_OWNER"], "buses.verify")).toBe(false);
    expect(hasPermission(["TRANSPORT_OWNER"], "drivers.verify")).toBe(false);
    expect(hasPermission(["GOVERNMENT"], "buses.verify")).toBe(false);
    expect(hasPermission(["GOVERNMENT"], "drivers.verify")).toBe(false);
    expect(hasPermission(["PASSENGER"], "buses.verify")).toBe(false);
  });

  it("does not let passengers read operational trip lists", () => {
    expect(TRIP_READ.some((p) => hasPermission(["PASSENGER"], p))).toBe(false);
    expect(TRIP_READ.some((p) => hasPermission(["DRIVER"], p))).toBe(true);
    expect(TRIP_READ.some((p) => hasPermission(["TRANSPORT_OWNER"], p))).toBe(true);
    expect(TRIP_READ.some((p) => hasPermission(["BRTA"], p))).toBe(true);
  });

  it("defines seven roles", () => {
    expect(Object.keys(ROLE_PERMISSIONS)).toHaveLength(7);
  });

  it("keeps drivers off admin and owner surfaces", () => {
    expect(hasPermission(["DRIVER"], "users.manage")).toBe(false);
    expect(hasPermission(["DRIVER"], "analytics.read")).toBe(false);
    expect(hasPermission(["DRIVER"], "buses.manage")).toBe(false);
    expect(hasPermission(["DRIVER"], "gps.ingest")).toBe(true);
  });

  it("keeps transport owners off user administration and SOS dispatch", () => {
    expect(hasPermission(["TRANSPORT_OWNER"], "users.manage")).toBe(false);
    expect(hasPermission(["TRANSPORT_OWNER"], "sos.manage")).toBe(false);
    expect(hasPermission(["TRANSPORT_OWNER"], "settings.manage")).toBe(false);
    expect(hasPermission(["TRANSPORT_OWNER"], "buses.manage")).toBe(true);
    expect(hasPermission(["TRANSPORT_OWNER"], "routes.manage")).toBe(true);
  });

  it("keeps government and BRTA off user and fleet mutation", () => {
    expect(hasPermission(["GOVERNMENT"], "users.manage")).toBe(false);
    expect(hasPermission(["GOVERNMENT"], "buses.manage")).toBe(false);
    expect(hasPermission(["GOVERNMENT"], "sos.manage")).toBe(true);
    expect(hasPermission(["BRTA"], "sos.manage")).toBe(false);
    expect(hasPermission(["BRTA"], "buses.read")).toBe(true);
    expect(hasPermission(["BRTA"], "buses.verify")).toBe(true);
  });
});
