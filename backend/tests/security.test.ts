import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();
const DEMO_PASSWORD = "Demo@12345";

async function login(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  return res;
}

function token(res: { body: { data?: { accessToken?: string } } }) {
  return res.body.data?.accessToken;
}

describe("GPS and RBAC HTTP security", () => {
  it("keeps source-mode public and unlabeled as a hardware feed", async () => {
    const res = await request(app).get("/api/gps/source-mode");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mode).toBeDefined();
  });

  it("returns PUBLIC GPS to unauthenticated callers", async () => {
    const res = await request(app).get("/api/gps/live");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.projection).toBe("PUBLIC");
    const items = res.body.data.items ?? [];
    if (items.length) {
      expect(items[0]).not.toHaveProperty("deviceId");
      expect(items[0]).not.toHaveProperty("driverId");
      expect(items[0]).not.toHaveProperty("tripId");
    }
  });

  it("blocks unauthenticated SOS and analytics", async () => {
    const sos = await request(app).post("/api/sos").send({
      latitude: 23.81,
      longitude: 90.41,
      message: "test",
    });
    expect(sos.status).toBe(401);
    const analytics = await request(app).get("/api/analytics/overview");
    expect(analytics.status).toBe(401);
  });

  it("does not give passengers operational GPS or user administration", async () => {
    const auth = await login("passenger.fatima@demo.bd");
    expect(auth.status).toBe(200);
    expect(token(auth)).toBeTruthy();
    const live = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(auth)}`);
    expect(live.status).toBe(200);
    expect(live.body.data.projection).toBe("PUBLIC");
    const users = await request(app).get("/api/users").set("Authorization", `Bearer ${token(auth)}`);
    expect(users.status).toBe(403);
    const settings = await request(app).get("/api/settings").set("Authorization", `Bearer ${token(auth)}`);
    expect(settings.status).toBe(403);
    const trips = await request(app).get("/api/trips").set("Authorization", `Bearer ${token(auth)}`);
    expect(trips.status).toBe(403);
  });

  it("does not give drivers admin-only data", async () => {
    const auth = await login("driver.rahim@demo.bd");
    expect(auth.status).toBe(200);
    expect(token(auth)).toBeTruthy();
    const users = await request(app).get("/api/users").set("Authorization", `Bearer ${token(auth)}`);
    expect(users.status).toBe(403);
    const analytics = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(auth)}`);
    expect(analytics.status).toBe(403);
    const live = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(auth)}`);
    expect(live.status).toBe(200);
    expect(live.body.data.projection).toBe("PUBLIC");
  });

  it("gives police emergency lists but not user administration", async () => {
    const auth = await login("police@nirapad.gov.bd");
    expect(auth.status).toBe(200);
    expect(token(auth)).toBeTruthy();
    const sos = await request(app).get("/api/sos").set("Authorization", `Bearer ${token(auth)}`);
    expect(sos.status).toBe(200);
    const users = await request(app).get("/api/users").set("Authorization", `Bearer ${token(auth)}`);
    expect(users.status).toBe(403);
    const live = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(auth)}`);
    expect(live.status).toBe(200);
    expect(live.body.data.projection).toBe("OPERATIONAL");
  });

  it("gives BRTA transport verification reads but not SOS dispatch", async () => {
    const auth = await login("brta@nirapad.gov.bd");
    expect(auth.status).toBe(200);
    expect(token(auth)).toBeTruthy();
    const buses = await request(app).get("/api/buses").set("Authorization", `Bearer ${token(auth)}`);
    expect(buses.status).toBe(200);
    const sosManage = await request(app)
      .put("/api/sos/00000000-0000-0000-0000-000000000000/status")
      .set("Authorization", `Bearer ${token(auth)}`)
      .send({ status: "ACKNOWLEDGED" });
    expect([403, 404, 422]).toContain(sosManage.status);
    expect(sosManage.status).not.toBe(200);
  });

  it("gives super admin administrative access", async () => {
    const auth = await login("admin@nirapad.gov.bd");
    expect(auth.status).toBe(200);
    expect(token(auth)).toBeTruthy();
    const users = await request(app).get("/api/users").set("Authorization", `Bearer ${token(auth)}`);
    expect(users.status).toBe(200);
    const settings = await request(app).get("/api/settings").set("Authorization", `Bearer ${token(auth)}`);
    expect(settings.status).toBe(200);
    const live = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(auth)}`);
    expect(live.status).toBe(200);
    expect(live.body.data.projection).toBe("OPERATIONAL");
  });
});
