import { describe, expect, it } from "vitest";
import {
  driverAssignmentBlockReason,
  isBdMobile,
  isDriverEligibleForDuty,
  isVehicleEligibleForAssignment,
  licenseNumberSchema,
  licenseValidity,
} from "../src/utils/driverDto.js";

describe("driver license and assignment rules", () => {
  it("accepts demo license numbers and Bangladesh mobiles", () => {
    expect(licenseNumberSchema.normalize(" dl demo 1001 ")).toBe("DL-DEMO-1001");
    expect(licenseNumberSchema.isValid("DL-DEMO-1001")).toBe(true);
    expect(licenseNumberSchema.isValid("!!")).toBe(false);
    expect(isBdMobile("01711200001")).toBe(true);
    expect(isBdMobile("123")).toBe(false);
  });

  it("computes license validity without claiming government verification", () => {
    expect(licenseValidity({ licenseStatus: "VALID", licenseExpiry: new Date("2027-12-31"), licenseNumber: "DL-1" })).toBe("VALID");
    expect(licenseValidity({ licenseStatus: "VALID", licenseExpiry: new Date("2020-01-01"), licenseNumber: "DL-1" })).toBe("EXPIRED");
    expect(licenseValidity({ licenseStatus: "PENDING", licenseNumber: "DL-1" })).toBe("PENDING");
    expect(licenseValidity({ licenseStatus: "SUSPENDED", licenseNumber: "DL-1" })).toBe("INVALID");
  });

  it("blocks suspended, inactive, and expired drivers from duty", () => {
    const ok = { status: "ACTIVE", licenseStatus: "VALID", licenseExpiry: new Date("2027-12-31"), licenseNumber: "DL-1", deletedAt: null };
    expect(isDriverEligibleForDuty(ok)).toBe(true);
    expect(isDriverEligibleForDuty({ ...ok, status: "SUSPENDED" })).toBe(false);
    expect(isDriverEligibleForDuty({ ...ok, status: "INACTIVE" })).toBe(false);
    expect(isDriverEligibleForDuty({ ...ok, licenseExpiry: new Date("2020-01-01") })).toBe(false);
    expect(driverAssignmentBlockReason({ ...ok, licenseStatus: "PENDING" })).toMatch(/not verified/i);
  });

  it("blocks offline or suspended vehicles from receiving an assignment", () => {
    expect(isVehicleEligibleForAssignment({ deletedAt: null, operationalStatus: "INACTIVE", registrationStatus: "PENDING" })).toBe(true);
    expect(isVehicleEligibleForAssignment({ deletedAt: null, operationalStatus: "OFFLINE", registrationStatus: "ACTIVE" })).toBe(false);
    expect(isVehicleEligibleForAssignment({ deletedAt: null, operationalStatus: "ACTIVE", registrationStatus: "SUSPENDED" })).toBe(false);
  });
});
