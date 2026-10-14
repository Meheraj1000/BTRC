import { describe, expect, it } from "vitest";
import { ApiError } from "../src/lib/apiResponse.js";
import { assertGpsJump, isValidCoordinate, parseGpsTimestamp, trackingState } from "../src/utils/gpsQuality.js";

describe("GPS quality rules", () => {
  it("accepts valid Bangladesh coordinates and rejects out-of-range values", () => {
    expect(isValidCoordinate(23.8103, 90.4125)).toBe(true);
    expect(isValidCoordinate(91, 90)).toBe(false);
    expect(isValidCoordinate(23, 190)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 90)).toBe(false);
  });

  it("rejects future and stale timestamps", () => {
    expect(() => parseGpsTimestamp(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toThrow(ApiError);
    expect(() => parseGpsTimestamp(new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())).toThrow(ApiError);
    expect(parseGpsTimestamp(new Date().toISOString()).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("rejects city-scale GPS jumps but allows short simulator deviation", () => {
    const previous = { latitude: 23.81, longitude: 90.41, timestamp: new Date() };
    expect(() =>
      assertGpsJump(previous, { latitude: 24.9, longitude: 91.87, timestamp: new Date() }),
    ).toThrow(ApiError);
    expect(() =>
      assertGpsJump(previous, { latitude: 23.822, longitude: 90.422, timestamp: new Date() }),
    ).not.toThrow();
  });

  it("marks recent samples online and older samples stale", () => {
    const now = Date.now();
    expect(trackingState(new Date(now - 10_000), now)).toBe("ONLINE");
    expect(trackingState(new Date(now - 120_000), now)).toBe("STALE");
  });
});
