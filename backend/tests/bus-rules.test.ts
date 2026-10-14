import { describe, expect, it } from "vitest";
import {
  canStartNormalTrip,
  isVerifiedForService,
  registrationNoSchema,
  tripBlockReason,
} from "../src/utils/busDto.js";

describe("vehicle registration and trip eligibility", () => {
  it("normalizes and accepts Bangladesh-style registration numbers", () => {
    expect(registrationNoSchema.normalize(" dhaka metro d 11-1234 ")).toBe("DHAKA-METRO-D-11-1234");
    expect(registrationNoSchema.isValid("DHAKA-METRO-D-DEMO-13")).toBe(true);
    expect(registrationNoSchema.isValid("SYL-DEMO-41")).toBe(true);
  });

  it("rejects malformed registration numbers", () => {
    expect(registrationNoSchema.isValid("AB")).toBe(false);
    expect(registrationNoSchema.isValid("!!!")).toBe(false);
    expect(registrationNoSchema.isValid("bus number")).toBe(false);
  });

  it("requires active registration and fitness before service", () => {
    expect(isVerifiedForService({ registrationStatus: "ACTIVE", fitnessStatus: "FIT" })).toBe(true);
    expect(isVerifiedForService({ registrationStatus: "PENDING", fitnessStatus: "FIT" })).toBe(false);
    expect(isVerifiedForService({ registrationStatus: "ACTIVE", fitnessStatus: "UNFIT" })).toBe(false);
  });

  it("blocks suspended, retired/offline, and unverified vehicles from a normal trip", () => {
    const base = {
      deletedAt: null,
      operationalStatus: "ACTIVE",
      registrationStatus: "ACTIVE",
      fitnessStatus: "FIT",
    };
    expect(canStartNormalTrip(base)).toBe(true);
    expect(canStartNormalTrip({ ...base, registrationStatus: "SUSPENDED" })).toBe(false);
    expect(canStartNormalTrip({ ...base, operationalStatus: "OFFLINE" })).toBe(false);
    expect(canStartNormalTrip({ ...base, operationalStatus: "INACTIVE" })).toBe(false);
    expect(canStartNormalTrip({ ...base, operationalStatus: "MAINTENANCE" })).toBe(false);
    expect(tripBlockReason({ ...base, registrationStatus: "SUSPENDED" })).toMatch(/suspended/i);
    expect(tripBlockReason({ ...base, operationalStatus: "OFFLINE" })).toMatch(/inactive or offline/i);
  });
});
