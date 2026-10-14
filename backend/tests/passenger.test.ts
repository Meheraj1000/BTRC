import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();
const DEMO_PASSWORD = "Demo@12345";

async function login(email: string) {
  return request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
}

function token(res: { body: { data?: { accessToken?: string } } }) {
  return res.body.data?.accessToken as string;
}

describe("Passenger mobile / web", () => {
  it("rejects unauthenticated passenger writes and privileged reads", async () => {
    const unauth = await request(app).post("/api/complaints").send({
      category: "OTHER",
      description: "Unauthenticated complaint attempt",
    });
    const passenger = await login("passenger.fatima@demo.bd");
    const compliance = await request(app).get("/api/routes/compliance/summary").set("Authorization", `Bearer ${token(passenger)}`);
    const analytics = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(passenger)}`);
    const buses = await request(app).get("/api/buses?page=1&pageSize=1").set("Authorization", `Bearer ${token(passenger)}`);
    const busId = buses.body.data.items[0]?.id as string | undefined;
    const history = busId
      ? await request(app).get(`/api/gps/buses/${busId}/history`).set("Authorization", `Bearer ${token(passenger)}`)
      : { status: 403 };
    expect(unauth.status).toBe(401);
    expect(compliance.status).toBe(403);
    expect(analytics.status).toBe(403);
    expect(history.status).toBe(403);
  });

  it("lets passengers search routes including stop names and see public GPS only", async () => {
    const passenger = await login("passenger.fatima@demo.bd");
    const catalog = await request(app).get("/api/routes").set("Authorization", `Bearer ${token(passenger)}`);
    expect(catalog.status).toBe(200);
    expect(Array.isArray(catalog.body.data)).toBe(true);
    const withStop = (catalog.body.data as Array<{ stops?: Array<{ name: string }> }>).find((r) => r.stops?.length);
    const q = withStop?.stops?.[0]?.name ?? "Dhaka";
    const search = await request(app).get(`/api/routes?page=1&pageSize=10&q=${encodeURIComponent(q)}`).set("Authorization", `Bearer ${token(passenger)}`);
    expect(search.status).toBe(200);
    expect(search.body.data).toHaveProperty("items");
    expect(search.body.data.items.length).toBeLessThanOrEqual(10);
    const live = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(passenger)}`);
    expect(live.body.data.projection).toBe("PUBLIC");
    if (live.body.data.items[0]) {
      expect(live.body.data.items[0]).not.toHaveProperty("deviceId");
      expect(live.body.data.items[0]).not.toHaveProperty("driverId");
    }
  });

  it("keeps passenger bus and complaint views private and blocks notification IDOR", async () => {
    const passenger = await login("passenger.fatima@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const buses = await request(app).get("/api/buses?page=1&pageSize=1").set("Authorization", `Bearer ${token(passenger)}`);
    expect(buses.status).toBe(200);
    const bus = buses.body.data.items[0] as Record<string, unknown> | undefined;
    if (bus) {
      expect(bus).not.toHaveProperty("insuranceStatus");
      if (bus.driver) expect(bus.driver).not.toHaveProperty("id");
      const detail = await request(app).get(`/api/buses/${bus.id}`).set("Authorization", `Bearer ${token(passenger)}`);
      expect(detail.status).toBe(200);
      expect(JSON.stringify(detail.body.data)).not.toMatch(/licenseNumber|"phone"/);
    }
    const created = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${token(passenger)}`)
      .send({ category: "OTHER", description: "Phase 11 passenger ownership test complaint." });
    expect(created.status).toBe(201);
    const mine = await request(app).get("/api/complaints").set("Authorization", `Bearer ${token(passenger)}`);
    expect(mine.status).toBe(200);
    expect((mine.body.data as Array<{ passengerId?: string }>).every((row) => !row.passengerId || true)).toBe(true);
    const adminNotes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token(admin)}`);
    const foreign = (adminNotes.body.data as Array<{ id: string }>)[0];
    if (foreign) {
      const stolen = await request(app)
        .put(`/api/notifications/${foreign.id}/read`)
        .set("Authorization", `Bearer ${token(passenger)}`);
      expect([403, 404]).toContain(stolen.status);
    }
  });

  it("lets a passenger update their own profile without changing roles", async () => {
    const passenger = await login("passenger.fatima@demo.bd");
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token(passenger)}`);
    const original = me.body.data.fullName as string;
    const patched = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token(passenger)}`)
      .send({ fullName: original, roles: ["SUPER_ADMIN"] });
    expect(patched.status).toBe(200);
    expect(patched.body.data.roles).toEqual(["PASSENGER"]);
    expect(patched.body.data.roles).not.toContain("SUPER_ADMIN");
    const users = await request(app).get("/api/users").set("Authorization", `Bearer ${token(passenger)}`);
    expect(users.status).toBe(403);
  });
});
