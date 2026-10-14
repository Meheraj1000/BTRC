import { beforeAll, describe, expect, it } from "vitest";
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

function uniqueCode() {
  return `P8-${Date.now().toString(36).toUpperCase()}`;
}

function uniqueReg() {
  return `TEST-P8-${Date.now().toString(36).toUpperCase()}99`;
}

const polyline = [
  { lat: 23.75, lng: 90.39 },
  { lat: 23.76, lng: 90.40 },
  { lat: 23.77, lng: 90.41 },
];

function routeBody(code: string) {
  return {
    code,
    name: `Phase 08 ${code}`,
    startName: "Farmgate",
    endName: "Mohakhali",
    startLat: 23.75,
    startLng: 90.39,
    endLat: 23.77,
    endLng: 90.41,
    city: "Dhaka",
    allowedSpeed: 40,
    polyline,
    stops: [
      { name: "Farmgate", sequence: 1, latitude: 23.75, longitude: 90.39 },
      { name: "Mohakhali", sequence: 2, latitude: 23.77, longitude: 90.41 },
    ],
  };
}

async function createActiveBus(ownerTok: string, adminTok: string, brtaTok: string, routeId?: string) {
  const created = await request(app)
    .post("/api/buses")
    .set("Authorization", `Bearer ${ownerTok}`)
    .send({
      registrationNo: uniqueReg(),
      vehicleType: "STANDARD_BUS",
      capacity: 40,
      routeId,
    });
  const id = created.body.data.id as string;
  await request(app)
    .patch(`/api/buses/${id}/verification`)
    .set("Authorization", `Bearer ${brtaTok}`)
    .send({ fitnessStatus: "FIT", registrationStatus: "ACTIVE", insuranceStatus: "VALID" });
  await request(app)
    .patch(`/api/buses/${id}/status`)
    .set("Authorization", `Bearer ${adminTok}`)
    .send({ operationalStatus: "ACTIVE" });
  return { created, id };
}

describe("Route management and compliance", () => {
  beforeAll(async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const drivers = await request(app).get("/api/drivers?pageSize=100").set("Authorization", `Bearer ${token(admin)}`);
    const items = (drivers.body.data.items ?? drivers.body.data) as Array<{ id: string; fullName?: string; user?: { fullName?: string } }>;
    const rahim = items.find((d) => /rahim/i.test(d.fullName ?? d.user?.fullName ?? ""));
    if (rahim) {
      await request(app)
        .patch(`/api/drivers/${rahim.id}/status`)
        .set("Authorization", `Bearer ${token(admin)}`)
        .send({ status: "ACTIVE" });
    }
  });

  it("creates a valid route and rejects invalid geometry", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const passenger = await login("passenger.fatima@demo.bd");
    const created = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send(routeBody(uniqueCode()));
    const invalid = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ ...routeBody(uniqueCode()), polyline: [{ lat: 91, lng: 90 }] });
    const unauth = await request(app).post("/api/routes").send(routeBody(uniqueCode()));
    const passengerWrite = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(passenger)}`)
      .send(routeBody(uniqueCode()));
    expect(created.status).toBe(201);
    expect(created.body.data.stops).toHaveLength(2);
    expect(invalid.status).toBe(422);
    expect(unauth.status).toBe(401);
    expect(passengerWrite.status).toBe(403);
    await request(app).delete(`/api/routes/${created.body.data.id}`).set("Authorization", `Bearer ${token(admin)}`);
  });

  it("updates a route, changes status, and keeps public catalog as an array", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const created = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send(routeBody(uniqueCode()));
    const id = created.body.data.id as string;
    const updated = await request(app)
      .put(`/api/routes/${id}`)
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ name: "Updated corridor" });
    const deactivated = await request(app)
      .patch(`/api/routes/${id}/status`)
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ status: "INACTIVE" });
    const catalog = await request(app).get("/api/routes");
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Updated corridor");
    expect(deactivated.body.data.status).toBe("INACTIVE");
    expect(Array.isArray(catalog.body.data)).toBe(true);
    expect((catalog.body.data as Array<{ id: string }>).some((r) => r.id === id)).toBe(false);
    await request(app).delete(`/api/routes/${id}`).set("Authorization", `Bearer ${token(admin)}`);
  });

  it("rejects invalid stop coordinates and duplicate sequences", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const created = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send(routeBody(uniqueCode()));
    const id = created.body.data.id as string;
    const badCoord = await request(app)
      .post(`/api/routes/${id}/stops`)
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ name: "Bad", sequence: 9, latitude: 91, longitude: 90 });
    const dup = await request(app)
      .put(`/api/routes/${id}/stops`)
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({
        stops: [
          { name: "A", sequence: 1, latitude: 23.75, longitude: 90.39 },
          { name: "B", sequence: 1, latitude: 23.76, longitude: 90.40 },
        ],
      });
    expect(badCoord.status).toBe(422);
    expect(dup.status).toBe(422);
    await request(app).delete(`/api/routes/${id}`).set("Authorization", `Bearer ${token(admin)}`);
  });

  it("blocks owner B from modifying or assigning against owner A routes", async () => {
    const green = await login("owner.greenline@demo.bd");
    const soudia = await login("owner.soudia@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const created = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(green)}`)
      .send(routeBody(uniqueCode()));
    expect(created.status).toBe(201);
    const routeId = created.body.data.id as string;
    const update = await request(app)
      .put(`/api/routes/${routeId}`)
      .set("Authorization", `Bearer ${token(soudia)}`)
      .send({ name: "Hijack" });
    const stop = await request(app)
      .post(`/api/routes/${routeId}/stops`)
      .set("Authorization", `Bearer ${token(soudia)}`)
      .send({ name: "X", sequence: 3, latitude: 23.78, longitude: 90.42 });
    const { id: soudiaBus } = await createActiveBus(token(soudia), token(admin), token(brta));
    const assign = await request(app)
      .post(`/api/routes/${routeId}/assign`)
      .set("Authorization", `Bearer ${token(soudia)}`)
      .send({ busId: soudiaBus });
    expect(update.status).toBe(403);
    expect(stop.status).toBe(403);
    expect(assign.status).toBe(403);
    await request(app).delete(`/api/buses/${soudiaBus}`).set("Authorization", `Bearer ${token(soudia)}`);
    await request(app).delete(`/api/routes/${routeId}`).set("Authorization", `Bearer ${token(green)}`);
  });

  it("assigns an active vehicle and rejects inactive or suspended vehicles", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const route = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send(routeBody(uniqueCode()));
    const routeId = route.body.data.id as string;
    const inactive = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ registrationNo: uniqueReg(), vehicleType: "MINIBUS", capacity: 24 });
    const inactiveAssign = await request(app)
      .post(`/api/routes/${routeId}/assign`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ busId: inactive.body.data.id });
    const { id: activeId } = await createActiveBus(token(owner), token(admin), token(brta));
    const okAssign = await request(app)
      .post(`/api/routes/${routeId}/assign`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ busId: activeId });
    await request(app)
      .patch(`/api/buses/${activeId}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ registrationStatus: "SUSPENDED" });
    const other = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send(routeBody(uniqueCode()));
    const suspendedAssign = await request(app)
      .post(`/api/routes/${other.body.data.id}/assign`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ busId: activeId });
    expect(inactiveAssign.status).toBe(409);
    expect(okAssign.status).toBe(200);
    expect(okAssign.body.data.assignedVehicleCount).toBeGreaterThanOrEqual(1);
    expect(suspendedAssign.status).toBe(409);
    await request(app).delete(`/api/buses/${inactive.body.data.id}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/buses/${activeId}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/routes/${routeId}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/routes/${other.body.data.id}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("rejects assignment when the assigned driver is not eligible", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const driver = await request(app)
      .post("/api/drivers")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({
        email: `p8.driver.${Date.now()}@demo.bd`,
        password: DEMO_PASSWORD,
        fullName: "Phase 08 Driver",
        licenseNumber: `DL-P8-${Date.now().toString(36).toUpperCase()}`,
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(driver.status).toBe(201);
    const driverId = driver.body.data.id as string;
    await request(app)
      .patch(`/api/drivers/${driverId}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ licenseStatus: "VALID" });
    const route = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send(routeBody(uniqueCode()));
    const { id: busId } = await createActiveBus(token(owner), token(admin), token(brta));
    const linked = await request(app)
      .put(`/api/buses/${busId}`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ driverId });
    expect(linked.status).toBe(200);
    await request(app)
      .patch(`/api/drivers/${driverId}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ licenseStatus: "EXPIRED" });
    const assign = await request(app)
      .post(`/api/routes/${route.body.data.id}/assign`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ busId });
    expect(assign.status).toBe(409);
    await request(app).delete(`/api/buses/${busId}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/drivers/${driverId}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/routes/${route.body.data.id}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("evaluates GPS against the assigned route and ignores a single noisy point", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const route = await request(app)
      .post("/api/routes")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send(routeBody(uniqueCode()));
    const routeId = route.body.data.id as string;
    const { id: busId } = await createActiveBus(token(owner), token(admin), token(brta), routeId);
    const onRoute = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 23.75, longitude: 90.39, speed: 18, heading: 10, source: "SIMULATION" });
    const noise = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 23.80, longitude: 90.50, speed: 18, heading: 10, source: "SIMULATION" });
    const persist1 = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 23.801, longitude: 90.501, speed: 18, heading: 10, source: "SIMULATION" });
    const persist2 = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 23.802, longitude: 90.502, speed: 18, heading: 10, source: "SIMULATION" });
    const back = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 23.76, longitude: 90.40, speed: 16, heading: 20, source: "SIMULATION" });
    const back2 = await request(app)
      .post("/api/gps/location")
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ busId, latitude: 23.761, longitude: 90.401, speed: 16, heading: 20, source: "SIMULATION" });
    const state = await request(app)
      .get(`/api/routes/compliance/buses/${busId}`)
      .set("Authorization", `Bearer ${token(owner)}`);
    const foreign = await request(app)
      .get(`/api/routes/compliance/buses/${busId}`)
      .set("Authorization", `Bearer ${token((await login("owner.soudia@demo.bd")))}`);
    expect(onRoute.status).toBe(200);
    expect(onRoute.body.data.complianceStatus).toBe("ON_ROUTE");
    expect(noise.body.data.complianceStatus).toBe("DEVIATING");
    expect(persist1.body.data.complianceStatus).toBe("DEVIATING");
    expect(persist2.body.data.complianceStatus).toBe("OFF_ROUTE");
    expect(back.body.data.complianceStatus).toBe("OFF_ROUTE");
    expect(back2.body.data.complianceStatus).toBe("ON_ROUTE");
    expect(state.status).toBe(200);
    expect(state.body.data.status).toBe("ON_ROUTE");
    expect(foreign.status).toBe(403);
    await request(app).delete(`/api/buses/${busId}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/routes/${routeId}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("requires authentication for compliance APIs and paginates events", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const unauth = await request(app).get("/api/routes/compliance/summary");
    const summary = await request(app).get("/api/routes/compliance/summary").set("Authorization", `Bearer ${token(admin)}`);
    const catalog = await request(app).get("/api/routes?page=1&pageSize=2").set("Authorization", `Bearer ${token(admin)}`);
    expect(unauth.status).toBe(401);
    expect(summary.status).toBe(200);
    expect(summary.body.data).toHaveProperty("vehiclesOnRoute");
    expect(catalog.body.data).toHaveProperty("items");
    expect(catalog.body.data.items.length).toBeLessThanOrEqual(2);
  });
});
