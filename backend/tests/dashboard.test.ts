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

describe("Government / admin dashboard", () => {
  it("rejects unauthenticated and unauthorized dashboard overview access", async () => {
    const unauth = await request(app).get("/api/analytics/overview");
    const passenger = await login("passenger.fatima@demo.bd");
    const driver = await login("driver.rahim@demo.bd");
    const deniedPassenger = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(passenger)}`);
    const deniedDriver = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(driver)}`);
    expect(unauth.status).toBe(401);
    expect(deniedPassenger.status).toBe(403);
    expect(deniedDriver.status).toBe(403);
  });

  it("allows authorized roles and returns database-backed summary cards", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const government = await login("government@nirapad.gov.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const police = await login("police@nirapad.gov.bd");
    const owner = await login("owner.greenline@demo.bd");
    const adminOverview = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(admin)}`);
    const govOverview = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(government)}`);
    const brtaOverview = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(brta)}`);
    const policeOverview = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(police)}`);
    const ownerOverview = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${token(owner)}`);
    expect(adminOverview.status).toBe(200);
    expect(govOverview.status).toBe(200);
    expect(brtaOverview.status).toBe(200);
    expect(policeOverview.status).toBe(200);
    expect(ownerOverview.status).toBe(200);
    const cards = adminOverview.body.data.cards as Record<string, number>;
    expect(cards.totalBuses).toBeGreaterThanOrEqual(cards.activeBuses ?? 0);
    expect(cards.totalDrivers).toBeGreaterThanOrEqual(cards.activeDrivers ?? 0);
    expect(cards.totalRoutes).toBeGreaterThanOrEqual(cards.activeRoutes ?? 0);
    expect(cards).toHaveProperty("vehiclesOnline");
    expect(cards).toHaveProperty("vehiclesOnRoute");
    expect(adminOverview.body.data.cards).toHaveProperty("totalPassengers");
    expect(policeOverview.body.data.cards).not.toHaveProperty("totalPassengers");
    expect(brtaOverview.body.data.cards).not.toHaveProperty("openSos");
    expect(ownerOverview.body.data.scope).toBe("COMPANY");
    expect(ownerOverview.body.data.cards.totalBuses).toBeLessThanOrEqual(cards.totalBuses);
  });

  it("scopes owner analytics lists and blocks cross-owner leakage", async () => {
    const green = await login("owner.greenline@demo.bd");
    const soudia = await login("owner.soudia@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const greenBuses = await request(app).get("/api/analytics/buses?page=1&pageSize=50").set("Authorization", `Bearer ${token(green)}`);
    const soudiaBuses = await request(app).get("/api/analytics/buses?page=1&pageSize=50").set("Authorization", `Bearer ${token(soudia)}`);
    const adminBuses = await request(app).get("/api/analytics/buses?page=1&pageSize=50").set("Authorization", `Bearer ${token(admin)}`);
    expect(greenBuses.status).toBe(200);
    expect(greenBuses.body.data).toHaveProperty("items");
    expect(greenBuses.body.data.items.length).toBeLessThanOrEqual(adminBuses.body.data.total);
    const greenCompanies = new Set((greenBuses.body.data.items as Array<{ company: string }>).map((b) => b.company));
    expect([...greenCompanies].every((name) => /green line/i.test(name))).toBe(true);
    const soudiaCompanies = new Set((soudiaBuses.body.data.items as Array<{ company: string }>).map((b) => b.company));
    if (soudiaBuses.body.data.items.length) {
      expect([...soudiaCompanies].some((name) => /green line/i.test(name))).toBe(false);
    }
  });

  it("paginates vehicle and driver monitoring sources and hides passenger dashboard APIs from passengers", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const passenger = await login("passenger.fatima@demo.bd");
    const vehicles = await request(app).get("/api/buses?page=1&pageSize=2").set("Authorization", `Bearer ${token(admin)}`);
    const drivers = await request(app).get("/api/drivers?page=1&pageSize=2").set("Authorization", `Bearer ${token(admin)}`);
    const activity = await request(app).get("/api/analytics/activity").set("Authorization", `Bearer ${token(admin)}`);
    const audit = await request(app).get("/api/audit-logs?page=1&pageSize=5").set("Authorization", `Bearer ${token(admin)}`);
    const passengerAudit = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token(passenger)}`);
    const passengerActivity = await request(app).get("/api/analytics/activity").set("Authorization", `Bearer ${token(passenger)}`);
    expect(vehicles.status).toBe(200);
    expect(vehicles.body.data.items.length).toBeLessThanOrEqual(2);
    expect(drivers.body.data.items.length).toBeLessThanOrEqual(2);
    expect(activity.status).toBe(200);
    expect(activity.body.data.alerts).toBeDefined();
    expect(JSON.stringify(activity.body.data)).not.toMatch(/passwordhash|refreshToken/i);
    expect(audit.status).toBe(200);
    expect(audit.body.data.items.length).toBeLessThanOrEqual(5);
    expect(audit.body.data.items[0] ?? {}).not.toHaveProperty("email");
    expect(passengerAudit.status).toBe(403);
    expect(passengerActivity.status).toBe(403);
  });

  it("shows latest GPS and rule-based compliance for authorized monitors only", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const owner = await login("owner.greenline@demo.bd");
    const passenger = await login("passenger.fatima@demo.bd");
    const live = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(admin)}`);
    const ownerLive = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(owner)}`);
    const compliance = await request(app).get("/api/routes/compliance/summary").set("Authorization", `Bearer ${token(admin)}`);
    const ownerCompliance = await request(app).get("/api/routes/compliance/summary").set("Authorization", `Bearer ${token(owner)}`);
    const passengerAnalytics = await request(app).get("/api/analytics/series").set("Authorization", `Bearer ${token(passenger)}`);
    expect(live.status).toBe(200);
    expect(live.body.data.projection).toBe("OPERATIONAL");
    if (live.body.data.items.length) {
      expect(live.body.data.items[0]).toHaveProperty("trackingState");
      expect(JSON.stringify(live.body.data.items[0])).not.toMatch(/password|refreshToken/i);
    }
    expect(ownerLive.status).toBe(200);
    expect(compliance.status).toBe(200);
    expect(compliance.body.data.method).toBe("RULE_BASED");
    expect(compliance.body.data.vehiclesOnRoute).toBeGreaterThanOrEqual(0);
    expect(compliance.body.data.vehiclesDeviating).toBeGreaterThanOrEqual(0);
    expect(ownerCompliance.body.data.assignedVehicles).toBeLessThanOrEqual(compliance.body.data.assignedVehicles);
    expect(passengerAnalytics.status).toBe(403);
  });

  it("does not let BRTA or owners read SOS through the incidents dashboard feed", async () => {
    const brta = await login("brta@nirapad.gov.bd");
    const owner = await login("owner.greenline@demo.bd");
    const police = await login("police@nirapad.gov.bd");
    const brtaIncidents = await request(app).get("/api/incidents").set("Authorization", `Bearer ${token(brta)}`);
    const ownerIncidents = await request(app).get("/api/incidents").set("Authorization", `Bearer ${token(owner)}`);
    const policeIncidents = await request(app).get("/api/incidents").set("Authorization", `Bearer ${token(police)}`);
    expect(brtaIncidents.status).toBe(200);
    expect(brtaIncidents.body.data.sos).toEqual([]);
    expect(ownerIncidents.body.data.sos).toEqual([]);
    expect(policeIncidents.status).toBe(200);
    expect(Array.isArray(policeIncidents.body.data.sos)).toBe(true);
  });
});
