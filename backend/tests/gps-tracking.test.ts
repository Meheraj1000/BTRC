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

describe("GPS live tracking", () => {
  it("rejects unauthenticated ingest and invalid coordinates", async () => {
    const unauth = await request(app).post("/api/gps/location").send({
      busId: "00000000-0000-0000-0000-000000000001",
      latitude: 23.81,
      longitude: 90.41,
      speed: 20,
      heading: 90,
    });
    const admin = await login("admin@nirapad.gov.bd");
    const invalid = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({
        busId: "00000000-0000-0000-0000-000000000001",
        latitude: 91,
        longitude: 90.41,
        speed: 20,
        heading: 90,
      });
    expect(unauth.status).toBe(401);
    expect(invalid.status).toBe(422);
  });

  it("rejects owner and passenger ingest and blocks driver spoofing of another vehicle", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const passenger = await login("passenger.fatima@demo.bd");
    const driver = await login("driver.rahim@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const created = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({
        registrationNo: `TEST-P7-${Date.now().toString(36).toUpperCase()}11`,
        vehicleType: "STANDARD_BUS",
        capacity: 40,
      });
    expect(created.status).toBe(201);
    const busId = created.body.data.id as string;
    const payload = { busId, latitude: 23.81, longitude: 90.41, speed: 18, heading: 80, source: "SIMULATION" };
    const ownerIngest = await request(app).post("/api/gps/location").set("Authorization", `Bearer ${token(owner)}`).send(payload);
    const passengerIngest = await request(app).post("/api/gps/location").set("Authorization", `Bearer ${token(passenger)}`).send(payload);
    const driverIngest = await request(app).post("/api/gps/location").set("Authorization", `Bearer ${token(driver)}`).send(payload);
    const adminIngest = await request(app).post("/api/gps/location").set("Authorization", `Bearer ${token(admin)}`).send(payload);
    expect(ownerIngest.status).toBe(403);
    expect(passengerIngest.status).toBe(403);
    expect(driverIngest.status).toBe(403);
    expect(adminIngest.status).toBe(200);
    expect(adminIngest.body.data.trackingState).toBe("ONLINE");
    expect(adminIngest.body.data.projection).toBe("OPERATIONAL");
    await request(app).delete(`/api/buses/${busId}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("blocks owner B from another owner's live location and history", async () => {
    const green = await login("owner.greenline@demo.bd");
    const soudia = await login("owner.soudia@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const created = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(green)}`)
      .send({
        registrationNo: `TEST-P7-${Date.now().toString(36).toUpperCase()}22`,
        vehicleType: "MINIBUS",
        capacity: 24,
      });
    expect(created.status).toBe(201);
    const busId = created.body.data.id as string;
    await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 23.75, longitude: 90.39, speed: 16, heading: 10, source: "SIMULATION" });
    const loc = await request(app).get(`/api/gps/buses/${busId}/location`).set("Authorization", `Bearer ${token(soudia)}`);
    const history = await request(app).get(`/api/gps/buses/${busId}/history`).set("Authorization", `Bearer ${token(soudia)}`);
    const ownHistory = await request(app).get(`/api/gps/buses/${busId}/history?page=1&pageSize=2`).set("Authorization", `Bearer ${token(green)}`);
    expect(loc.status).toBe(403);
    expect(history.status).toBe(403);
    expect(ownHistory.status).toBe(200);
    expect(ownHistory.body.data.items.length).toBeLessThanOrEqual(2);
    expect(ownHistory.body.data).toHaveProperty("total");
    await request(app).delete(`/api/buses/${busId}`).set("Authorization", `Bearer ${token(green)}`);
  });

  it("scopes owner live lists to their fleet and keeps public live public", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const pub = await request(app).get("/api/gps/live");
    const ownerLive = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(owner)}`);
    const adminLive = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(admin)}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.projection).toBe("PUBLIC");
    expect(ownerLive.status).toBe(200);
    expect(ownerLive.body.data.projection).toBe("OPERATIONAL");
    expect(adminLive.body.data.items.length).toBeGreaterThanOrEqual(ownerLive.body.data.items.length);
    for (const row of ownerLive.body.data.items as Array<{ companyId?: string; trackingState?: string }>) {
      expect(row.trackingState).toMatch(/ONLINE|STALE/);
    }
  });

  it("rejects a future timestamp and an unrealistic jump", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const created = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({
        registrationNo: `TEST-P7-${Date.now().toString(36).toUpperCase()}33`,
        vehicleType: "STANDARD_BUS",
        capacity: 40,
      });
    const busId = created.body.data.id as string;
    await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 23.81, longitude: 90.41, speed: 12, heading: 0, source: "SIMULATION" });
    const future = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({
        busId,
        latitude: 23.811,
        longitude: 90.411,
        speed: 12,
        heading: 0,
        timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        source: "SIMULATION",
      });
    const jump = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 22.3569, longitude: 91.7832, speed: 12, heading: 0, source: "SIMULATION" });
    expect(future.status).toBe(422);
    expect(jump.status).toBe(422);
    await request(app).delete(`/api/buses/${busId}`).set("Authorization", `Bearer ${token(owner)}`);
  });
});
