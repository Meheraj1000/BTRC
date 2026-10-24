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

describe("Police and emergency monitoring", () => {
  it("rejects unauthenticated and unauthorized alert access", async () => {
    const unauth = await request(app).get("/api/alerts");
    const passenger = await login("passenger.fatima@demo.bd");
    const owner = await login("owner.greenline@demo.bd");
    const deniedPassenger = await request(app).get("/api/alerts").set("Authorization", `Bearer ${token(passenger)}`);
    const ownerManage = await request(app)
      .put("/api/alerts/00000000-0000-0000-0000-000000000001/status")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ status: "ACKNOWLEDGED" });
    expect(unauth.status).toBe(401);
    expect(deniedPassenger.status).toBe(403);
    expect(ownerManage.status).toBe(403);
  });

  it("allows police to read paginated operational events and GPS", async () => {
    const police = await login("police@nirapad.gov.bd");
    const alerts = await request(app).get("/api/alerts?page=1&pageSize=5").set("Authorization", `Bearer ${token(police)}`);
    const incidents = await request(app).get("/api/incidents?page=1&pageSize=5").set("Authorization", `Bearer ${token(police)}`);
    const overview = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(police)}`);
    const live = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(police)}`);
    const compliance = await request(app).get("/api/routes/compliance/summary").set("Authorization", `Bearer ${token(police)}`);
    expect(alerts.status).toBe(200);
    expect(alerts.body.data).toHaveProperty("items");
    expect(alerts.body.data.items.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(alerts.body.data)).not.toMatch(/password|refreshToken|"email"/i);
    expect(incidents.status).toBe(200);
    expect(Array.isArray(incidents.body.data.sos)).toBe(true);
    expect(JSON.stringify(incidents.body.data.sos)).not.toMatch(/email|phone/i);
    expect(overview.status).toBe(200);
    expect(overview.body.data.cards).toHaveProperty("vehiclesDeviating");
    expect(overview.body.data.cards).toHaveProperty("openSos");
    expect(live.body.data.projection).toBe("OPERATIONAL");
    expect(compliance.body.data.method).toBe("RULE_BASED");
  });

  it("lets police acknowledge and resolve an alert and rejects invalid status", async () => {
    const police = await login("police@nirapad.gov.bd");
    const government = await login("government@nirapad.gov.bd");
    const listed = await request(app).get("/api/alerts?page=1&pageSize=20").set("Authorization", `Bearer ${token(police)}`);
    const open = (listed.body.data.items as Array<{ id: string; status: string }>).find((row) => row.status !== "RESOLVED");
    const invalid = await request(app)
      .put("/api/alerts/00000000-0000-0000-0000-000000000001/status")
      .set("Authorization", `Bearer ${token(police)}`)
      .send({ status: "DISPATCHED" });
    const missing = await request(app)
      .put("/api/alerts/00000000-0000-0000-0000-000000000001/status")
      .set("Authorization", `Bearer ${token(police)}`)
      .send({ status: "ACKNOWLEDGED" });
    expect(invalid.status).toBe(422);
    expect(missing.status).toBe(404);
    if (open) {
      const govDenied = await request(app)
        .put(`/api/alerts/${open.id}/status`)
        .set("Authorization", `Bearer ${token(government)}`)
        .send({ status: "ACKNOWLEDGED" });
      expect(govDenied.status).toBe(403);
      const ack = await request(app)
        .put(`/api/alerts/${open.id}/status`)
        .set("Authorization", `Bearer ${token(police)}`)
        .send({ status: "ACKNOWLEDGED" });
      expect(ack.status).toBe(200);
      expect(ack.body.data.status).toBe("ACKNOWLEDGED");
      expect(ack.body.data).not.toHaveProperty("email");
      const resolved = await request(app)
        .put(`/api/alerts/${open.id}/status`)
        .set("Authorization", `Bearer ${token(police)}`)
        .send({ status: "RESOLVED" });
      expect(resolved.status).toBe(200);
      expect(resolved.body.data.status).toBe("RESOLVED");
    }
  });

  it("scopes owner alert lists and hides police-sensitive driver fields", async () => {
    const green = await login("owner.greenline@demo.bd");
    const police = await login("police@nirapad.gov.bd");
    const ownerAlerts = await request(app).get("/api/alerts?page=1&pageSize=50").set("Authorization", `Bearer ${token(green)}`);
    const drivers = await request(app).get("/api/drivers?page=1&pageSize=5").set("Authorization", `Bearer ${token(police)}`);
    const buses = await request(app).get("/api/buses?page=1&pageSize=5&trackingState=STALE").set("Authorization", `Bearer ${token(police)}`);
    const policeAlerts = await request(app).get("/api/alerts?page=1&pageSize=50").set("Authorization", `Bearer ${token(police)}`);
    const government = await login("government@nirapad.gov.bd");
    const nationalAlerts = await request(app).get("/api/alerts?page=1&pageSize=50").set("Authorization", `Bearer ${token(government)}`);
    expect(ownerAlerts.status).toBe(200);
    expect(policeAlerts.body.data.total).toBeLessThanOrEqual(nationalAlerts.body.data.total);
    expect(drivers.status).toBe(200);
    const sample = drivers.body.data.items[0] as Record<string, unknown> | undefined;
    if (sample) {
      expect(sample).not.toHaveProperty("email");
      expect(sample).not.toHaveProperty("phone");
      expect(sample).toHaveProperty("fullName");
      expect(sample).toHaveProperty("licenseStatus");
    }
    expect(buses.status).toBe(200);
    expect(buses.body.data.items.length).toBeLessThanOrEqual(5);
  });
});
