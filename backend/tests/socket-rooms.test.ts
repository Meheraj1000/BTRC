import { describe, expect, it } from "vitest";
import { canJoinSocketRoom } from "../src/utils/socketRooms.js";

describe("Socket.IO room authorization", () => {
  it("allows anyone onto the public bus channel", () => {
    expect(canJoinSocketRoom("public:buses")).toBe(true);
    expect(canJoinSocketRoom("public:buses", null)).toBe(true);
  });

  it("rejects operational and user rooms without a matching identity", () => {
    expect(canJoinSocketRoom("role:SUPER_ADMIN")).toBe(false);
    expect(canJoinSocketRoom("role:POLICE", { sub: "u1", roles: ["PASSENGER"] })).toBe(false);
    expect(canJoinSocketRoom("user:other", { sub: "u1", roles: ["PASSENGER"] })).toBe(false);
    expect(canJoinSocketRoom("ops:secret", { sub: "u1", roles: ["SUPER_ADMIN"] })).toBe(false);
  });

  it("allows a user onto their own role and user rooms only", () => {
    const police = { sub: "u-police", roles: ["POLICE"] };
    expect(canJoinSocketRoom("role:POLICE", police)).toBe(true);
    expect(canJoinSocketRoom("user:u-police", police)).toBe(true);
    expect(canJoinSocketRoom("role:SUPER_ADMIN", police)).toBe(false);
  });

  it("scopes company GPS rooms to the matching owner", () => {
    const owner = { sub: "u-owner", roles: ["TRANSPORT_OWNER"], companyId: "co-a" };
    expect(canJoinSocketRoom("company:co-a", owner)).toBe(true);
    expect(canJoinSocketRoom("company:co-b", owner)).toBe(false);
    expect(canJoinSocketRoom("company:co-b", { sub: "admin", roles: ["SUPER_ADMIN"] })).toBe(true);
    expect(canJoinSocketRoom("company:co-a")).toBe(false);
    expect(canJoinSocketRoom("place:Dhaka", { sub: "u-police", roles: ["POLICE"] })).toBe(false);
    expect(canJoinSocketRoom("place:Dhaka", { sub: "u-police", roles: ["POLICE"], places: ["Dhaka"] })).toBe(true);
    expect(canJoinSocketRoom("place:Sylhet", { sub: "u-police", roles: ["POLICE"], places: ["Dhaka"] })).toBe(false);
  });
});
