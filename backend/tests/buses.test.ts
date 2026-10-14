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

function uniqueReg() {
  return `TEST-P5-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
}

function leak(body: unknown) {
  return JSON.stringify(body).toLowerCase();
}

describe("vehicle registration and management", () => {
  it("rejects unauthenticated vehicle creation", async () => {
    const res = await request(app).post("/api/buses").send({
      registrationNo: uniqueReg(),
      vehicleType: "STANDARD_BUS",
      capacity: 40,
    });
    expect(res.status).toBe(401);
  });

  it("rejects passenger and driver vehicle creation", async () => {
    const passenger = await login("passenger.fatima@demo.bd");
    const driver = await login("driver.rahim@demo.bd");
    expect(passenger.status).toBe(200);
    expect(driver.status).toBe(200);
    const p = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(passenger)}`)
      .send({ registrationNo: uniqueReg(), vehicleType: "STANDARD_BUS", capacity: 40 });
    const d = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(driver)}`)
      .send({ registrationNo: uniqueReg(), vehicleType: "STANDARD_BUS", capacity: 40 });
    expect(p.status).toBe(403);
    expect(d.status).toBe(403);
  });

  it("lets an owner create a vehicle for their own company only", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    expect(owner.status).toBe(200);
    expect(admin.status).toBe(200);
    const companies = await request(app).get("/api/companies").set("Authorization", `Bearer ${token(admin)}`);
    const soudia = (companies.body.data as Array<{ id: string; name: string }>).find((c) => /soudia/i.test(c.name));
    const created = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({
        registrationNo: uniqueReg(),
        vehicleType: "MINIBUS",
        capacity: 24,
        companyId: soudia?.id,
        manufacturer: "Hino",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.company?.name).toMatch(/green line/i);
    expect(created.body.data.registrationStatus).toBe("PENDING");
    expect(created.body.data.fitnessStatus).toBe("PENDING");
    expect(created.body.data.operationalStatus).toBe("INACTIVE");
    expect(leak(created.body)).not.toContain("passwordhash");
    const activate = await request(app)
      .patch(`/api/buses/${created.body.data.id}/status`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ operationalStatus: "ACTIVE" });
    expect(activate.status).toBe(409);
    await request(app).delete(`/api/buses/${created.body.data.id}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("blocks an owner from reading or updating another owner's vehicle", async () => {
    const green = await login("owner.greenline@demo.bd");
    const soudia = await login("owner.soudia@demo.bd");
    expect(green.status).toBe(200);
    expect(soudia.status).toBe(200);
    const created = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(green)}`)
      .send({ registrationNo: uniqueReg(), vehicleType: "STANDARD_BUS", capacity: 40 });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const read = await request(app).get(`/api/buses/${id}`).set("Authorization", `Bearer ${token(soudia)}`);
    const put = await request(app)
      .put(`/api/buses/${id}`)
      .set("Authorization", `Bearer ${token(soudia)}`)
      .send({ capacity: 36 });
    const status = await request(app)
      .patch(`/api/buses/${id}/status`)
      .set("Authorization", `Bearer ${token(soudia)}`)
      .send({ operationalStatus: "MAINTENANCE" });
    expect(read.status).toBe(403);
    expect(put.status).toBe(403);
    expect(status.status).toBe(403);
    await request(app).delete(`/api/buses/${id}`).set("Authorization", `Bearer ${token(green)}`);
  });

  it("blocks owners and unauthorized roles from changing verification", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const passenger = await login("passenger.fatima@demo.bd");
    const government = await login("government@nirapad.gov.bd");
    expect(owner.status).toBe(200);
    const created = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ registrationNo: uniqueReg(), vehicleType: "STANDARD_BUS", capacity: 40 });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const ownerVerify = await request(app)
      .patch(`/api/buses/${id}/verification`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ fitnessStatus: "FIT", registrationStatus: "ACTIVE" });
    const ownerPut = await request(app)
      .put(`/api/buses/${id}`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ fitnessStatus: "FIT" });
    const passengerVerify = await request(app)
      .patch(`/api/buses/${id}/verification`)
      .set("Authorization", `Bearer ${token(passenger)}`)
      .send({ fitnessStatus: "FIT" });
    const govVerify = await request(app)
      .patch(`/api/buses/${id}/verification`)
      .set("Authorization", `Bearer ${token(government)}`)
      .send({ fitnessStatus: "FIT" });
    expect(ownerVerify.status).toBe(403);
    expect(ownerPut.status).toBe(403);
    expect(passengerVerify.status).toBe(403);
    expect(govVerify.status).toBe(403);
    await request(app).delete(`/api/buses/${id}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("lets BRTA apply manual / simulated verification", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const brta = await login("brta@nirapad.gov.bd");
    expect(owner.status).toBe(200);
    expect(brta.status).toBe(200);
    const created = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ registrationNo: uniqueReg(), vehicleType: "AC_BUS", capacity: 36 });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const verified = await request(app)
      .patch(`/api/buses/${id}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ fitnessStatus: "FIT", registrationStatus: "ACTIVE", insuranceStatus: "VALID" });
    expect(verified.status).toBe(200);
    expect(verified.body.data.fitnessStatus).toBe("FIT");
    expect(verified.body.data.registrationStatus).toBe("ACTIVE");
    expect(verified.body.message).toMatch(/manual|simulated/i);
    await request(app).delete(`/api/buses/${id}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("rejects invalid registration numbers, duplicates, and invalid capacity", async () => {
    const owner = await login("owner.greenline@demo.bd");
    expect(owner.status).toBe(200);
    const invalid = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ registrationNo: "!!", vehicleType: "STANDARD_BUS", capacity: 40 });
    const capacity = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ registrationNo: uniqueReg(), vehicleType: "STANDARD_BUS", capacity: 2 });
    const duplicate = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ registrationNo: "DHAKA-METRO-D-DEMO-13", vehicleType: "STANDARD_BUS", capacity: 40 });
    expect(invalid.status).toBe(422);
    expect(capacity.status).toBe(422);
    expect(duplicate.status).toBe(409);
  });

  it("supports paginated search and filters", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    expect(admin.status).toBe(200);
    const page = await request(app)
      .get("/api/buses?page=1&pageSize=2&sortBy=registrationNo")
      .set("Authorization", `Bearer ${token(admin)}`);
    expect(page.status).toBe(200);
    expect(page.body.data.items.length).toBeLessThanOrEqual(2);
    expect(page.body.data.total).toBeGreaterThan(2);
    const search = await request(app)
      .get("/api/buses?q=SYL")
      .set("Authorization", `Bearer ${token(admin)}`);
    expect(search.status).toBe(200);
    expect((search.body.data.items as Array<{ registrationNo: string }>).every((b) => b.registrationNo.includes("SYL"))).toBe(true);
    const filtered = await request(app)
      .get("/api/buses?operationalStatus=ACTIVE&vehicleType=STANDARD_BUS")
      .set("Authorization", `Bearer ${token(admin)}`);
    expect(filtered.status).toBe(200);
    for (const bus of filtered.body.data.items as Array<{ operationalStatus: string; vehicleType: string }>) {
      expect(bus.operationalStatus).toBe("ACTIVE");
      expect(bus.vehicleType).toBe("STANDARD_BUS");
    }
  });

  it("hides private fields from passengers and keeps driver access assigned-only", async () => {
    const passenger = await login("passenger.fatima@demo.bd");
    const driver = await login("driver.rahim@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    expect(passenger.status).toBe(200);
    const list = await request(app).get("/api/buses?pageSize=100").set("Authorization", `Bearer ${token(admin)}`);
    const anyBus = list.body.data.items[0] as { id: string; driverId?: string };
    const publicView = await request(app).get(`/api/buses/${anyBus.id}`).set("Authorization", `Bearer ${token(passenger)}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.data).not.toHaveProperty("insuranceStatus");
    expect(publicView.body.data).not.toHaveProperty("gpsDevice");
    expect(leak(publicView.body)).not.toContain("passwordhash");
    const driverList = await request(app).get("/api/buses?pageSize=100").set("Authorization", `Bearer ${token(driver)}`);
    expect(driverList.status).toBe(200);
    const assignedIds = new Set((driverList.body.data.items as Array<{ id: string }>).map((b) => b.id));
    const foreign = (list.body.data.items as Array<{ id: string }>).find((b) => !assignedIds.has(b.id));
    if (foreign) {
      const denied = await request(app).get(`/api/buses/${foreign.id}`).set("Authorization", `Bearer ${token(driver)}`);
      expect(denied.status).toBe(403);
    }
  });

  it("blocks a normal trip when registration is suspended or the vehicle is offline", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const driver = await login("driver.rahim@demo.bd");
    const brta = await login("brta@nirapad.gov.bd");
    expect(owner.status).toBe(200);
    const routes = await request(app).get("/api/routes").set("Authorization", `Bearer ${token(admin)}`);
    const drivers = await request(app).get("/api/drivers?pageSize=100").set("Authorization", `Bearer ${token(admin)}`);
    const routeId = (routes.body.data as Array<{ id: string }>)[0]?.id;
    const driverItems = (drivers.body.data.items ?? drivers.body.data) as Array<{ id: string; fullName?: string; user?: { fullName?: string } }>;
    const rahim = driverItems.find((d) => /rahim/i.test(d.fullName ?? d.user?.fullName ?? ""));
    expect(routeId).toBeTruthy();
    expect(rahim?.id).toBeTruthy();
    const created = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({
        registrationNo: uniqueReg(),
        vehicleType: "STANDARD_BUS",
        capacity: 40,
        routeId,
        driverId: rahim?.id,
      });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    await request(app)
      .patch(`/api/buses/${id}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ fitnessStatus: "FIT", registrationStatus: "ACTIVE", insuranceStatus: "VALID" });
    await request(app)
      .patch(`/api/buses/${id}/status`)
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ operationalStatus: "ACTIVE" });
    await request(app)
      .patch(`/api/buses/${id}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ registrationStatus: "SUSPENDED" });
    const suspended = await request(app)
      .post("/api/trips/start")
      .set("Authorization", `Bearer ${token(driver)}`)
      .send({ busId: id, latitude: 23.75, longitude: 90.39 });
    expect(suspended.status).toBe(409);
    await request(app)
      .patch(`/api/buses/${id}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ registrationStatus: "ACTIVE" });
    await request(app)
      .patch(`/api/buses/${id}/status`)
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ operationalStatus: "OFFLINE" });
    const retired = await request(app)
      .post("/api/trips/start")
      .set("Authorization", `Bearer ${token(driver)}`)
      .send({ busId: id, latitude: 23.75, longitude: 90.39 });
    expect(retired.status).toBe(409);
    await request(app).delete(`/api/buses/${id}`).set("Authorization", `Bearer ${token(owner)}`);
  });
});
