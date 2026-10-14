import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();
const DEMO_PASSWORD = "Demo@12345";
const DRIVER_PASSWORD = "Driver@12345";

async function login(email: string) {
  return request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
}

function token(res: { body: { data?: { accessToken?: string } } }) {
  return res.body.data?.accessToken as string;
}

function uniqueLicense() {
  return `DL-P6-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
}

function uniqueEmail() {
  return `p6.driver.${Date.now()}${Math.floor(Math.random() * 90 + 10)}@demo.bd`;
}

function uniquePhone() {
  return `018${String(Date.now()).slice(-8)}`;
}

function leak(body: unknown) {
  return JSON.stringify(body).toLowerCase();
}

async function createOwnedDriver(ownerToken: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post("/api/drivers")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      fullName: "Phase 06 Test Driver",
      email: uniqueEmail(),
      password: DRIVER_PASSWORD,
      phone: uniquePhone(),
      licenseNumber: uniqueLicense(),
      licenseExpiry: new Date("2027-12-31").toISOString(),
      experienceYears: 4,
      ...overrides,
    });
}

describe("driver registration and management", () => {
  it("rejects unauthenticated, passenger, and driver create attempts", async () => {
    const unauth = await request(app).post("/api/drivers").send({
      fullName: "X",
      email: uniqueEmail(),
      password: DRIVER_PASSWORD,
      licenseNumber: uniqueLicense(),
    });
    const passenger = await login("passenger.fatima@demo.bd");
    const driver = await login("driver.rahim@demo.bd");
    const p = await request(app)
      .post("/api/drivers")
      .set("Authorization", `Bearer ${token(passenger)}`)
      .send({ fullName: "X", email: uniqueEmail(), password: DRIVER_PASSWORD, licenseNumber: uniqueLicense() });
    const d = await request(app)
      .post("/api/drivers")
      .set("Authorization", `Bearer ${token(driver)}`)
      .send({ fullName: "X", email: uniqueEmail(), password: DRIVER_PASSWORD, licenseNumber: uniqueLicense() });
    expect(unauth.status).toBe(401);
    expect(p.status).toBe(403);
    expect(d.status).toBe(403);
  });

  it("lets an owner register a driver on their own company only", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const companies = await request(app).get("/api/companies").set("Authorization", `Bearer ${token(admin)}`);
    const soudia = (companies.body.data as Array<{ id: string; name: string }>).find((c) => /soudia/i.test(c.name));
    const created = await createOwnedDriver(token(owner), { companyId: soudia?.id });
    expect(created.status).toBe(201);
    expect(created.body.data.company?.name).toMatch(/green line/i);
    expect(created.body.data.licenseStatus).toBe("PENDING");
    expect(created.body.data.dutyEligible).toBe(false);
    expect(leak(created.body)).not.toContain("passwordhash");
    expect(created.body.data).not.toHaveProperty("nidReference");
    await request(app).delete(`/api/drivers/${created.body.data.id}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("blocks an owner from reading or updating another owner's driver", async () => {
    const green = await login("owner.greenline@demo.bd");
    const soudia = await login("owner.soudia@demo.bd");
    const created = await createOwnedDriver(token(green));
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const read = await request(app).get(`/api/drivers/${id}`).set("Authorization", `Bearer ${token(soudia)}`);
    const put = await request(app)
      .put(`/api/drivers/${id}`)
      .set("Authorization", `Bearer ${token(soudia)}`)
      .send({ experienceYears: 9 });
    expect(read.status).toBe(403);
    expect(put.status).toBe(403);
    await request(app).delete(`/api/drivers/${id}`).set("Authorization", `Bearer ${token(green)}`);
  });

  it("blocks unauthorized verification and lets BRTA apply manual verification", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const passenger = await login("passenger.fatima@demo.bd");
    const government = await login("government@nirapad.gov.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const created = await createOwnedDriver(token(owner));
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const ownerVerify = await request(app)
      .patch(`/api/drivers/${id}/verification`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ licenseStatus: "VALID" });
    const ownerPut = await request(app)
      .put(`/api/drivers/${id}`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ licenseStatus: "VALID" });
    const passengerVerify = await request(app)
      .patch(`/api/drivers/${id}/verification`)
      .set("Authorization", `Bearer ${token(passenger)}`)
      .send({ licenseStatus: "VALID" });
    const govVerify = await request(app)
      .patch(`/api/drivers/${id}/verification`)
      .set("Authorization", `Bearer ${token(government)}`)
      .send({ licenseStatus: "VALID" });
    const verified = await request(app)
      .patch(`/api/drivers/${id}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ licenseStatus: "VALID" });
    expect(ownerVerify.status).toBe(403);
    expect(ownerPut.status).toBe(403);
    expect(passengerVerify.status).toBe(403);
    expect(govVerify.status).toBe(403);
    expect(verified.status).toBe(200);
    expect(verified.body.data.licenseStatus).toBe("VALID");
    expect(verified.body.data.dutyEligible).toBe(true);
    expect(verified.body.message).toMatch(/manual|simulated/i);
    await request(app).delete(`/api/drivers/${id}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("rejects invalid license numbers, duplicate licenses, and invalid phones", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const invalid = await createOwnedDriver(token(owner), { licenseNumber: "!!" });
    const phone = await createOwnedDriver(token(owner), { phone: "12345" });
    const duplicate = await createOwnedDriver(token(owner), { licenseNumber: "DL-DEMO-1001" });
    expect(invalid.status).toBe(422);
    expect(phone.status).toBe(422);
    expect(duplicate.status).toBe(409);
  });

  it("supports paginated search and filters", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const page = await request(app)
      .get("/api/drivers?page=1&pageSize=2")
      .set("Authorization", `Bearer ${token(admin)}`);
    expect(page.status).toBe(200);
    expect(page.body.data.items.length).toBeLessThanOrEqual(2);
    expect(page.body.data.total).toBeGreaterThan(2);
    const search = await request(app)
      .get("/api/drivers?q=Rahim")
      .set("Authorization", `Bearer ${token(admin)}`);
    expect(search.status).toBe(200);
    expect((search.body.data.items as Array<{ fullName?: string }>).some((d) => /rahim/i.test(d.fullName ?? ""))).toBe(true);
  });

  it("blocks pending, expired, and suspended drivers from vehicle assignment", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const bus = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ registrationNo: `TEST-P6-${Date.now().toString(36).toUpperCase()}11`, vehicleType: "STANDARD_BUS", capacity: 40 });
    expect(bus.status).toBe(201);
    const busId = bus.body.data.id as string;

    const pending = await createOwnedDriver(token(owner));
    expect(pending.status).toBe(201);
    const pendingAssign = await request(app)
      .patch(`/api/drivers/${pending.body.data.id}/assignment`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ busId });
    expect(pendingAssign.status).toBe(409);

    const expired = await createOwnedDriver(token(owner), { licenseExpiry: new Date("2020-01-01").toISOString() });
    await request(app)
      .patch(`/api/drivers/${expired.body.data.id}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ licenseStatus: "VALID" });
    const expiredAssign = await request(app)
      .patch(`/api/drivers/${expired.body.data.id}/assignment`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ busId });
    expect(expiredAssign.status).toBe(409);

    const suspended = await createOwnedDriver(token(owner));
    await request(app)
      .patch(`/api/drivers/${suspended.body.data.id}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ licenseStatus: "VALID" });
    const ownerSuspend = await request(app)
      .patch(`/api/drivers/${suspended.body.data.id}/status`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ status: "SUSPENDED" });
    expect(ownerSuspend.status).toBe(403);
    await request(app)
      .patch(`/api/drivers/${suspended.body.data.id}/status`)
      .set("Authorization", `Bearer ${token(admin)}`)
      .send({ status: "SUSPENDED" });
    const suspendedAssign = await request(app)
      .patch(`/api/drivers/${suspended.body.data.id}/assignment`)
      .set("Authorization", `Bearer ${token(owner)}`)
      .send({ busId });
    expect(suspendedAssign.status).toBe(409);

    await request(app).delete(`/api/drivers/${pending.body.data.id}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/drivers/${expired.body.data.id}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/drivers/${suspended.body.data.id}`).set("Authorization", `Bearer ${token(owner)}`);
    await request(app).delete(`/api/buses/${busId}`).set("Authorization", `Bearer ${token(owner)}`);
  });

  it("assigns an eligible driver to a same-operator vehicle and blocks cross-owner assignment", async () => {
    const green = await login("owner.greenline@demo.bd");
    const soudia = await login("owner.soudia@demo.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const bus = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(green)}`)
      .send({ registrationNo: `TEST-P6-${Date.now().toString(36).toUpperCase()}22`, vehicleType: "MINIBUS", capacity: 24 });
    const soudiaBus = await request(app)
      .post("/api/buses")
      .set("Authorization", `Bearer ${token(soudia)}`)
      .send({ registrationNo: `TEST-P6-${Date.now().toString(36).toUpperCase()}33`, vehicleType: "STANDARD_BUS", capacity: 40 });
    expect(bus.status).toBe(201);
    expect(soudiaBus.status).toBe(201);
    const created = await createOwnedDriver(token(green));
    await request(app)
      .patch(`/api/drivers/${created.body.data.id}/verification`)
      .set("Authorization", `Bearer ${token(brta)}`)
      .send({ licenseStatus: "VALID" });
    const assigned = await request(app)
      .patch(`/api/drivers/${created.body.data.id}/assignment`)
      .set("Authorization", `Bearer ${token(green)}`)
      .send({ busId: bus.body.data.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.buses.some((b: { id: string }) => b.id === bus.body.data.id)).toBe(true);
    const cross = await request(app)
      .patch(`/api/drivers/${created.body.data.id}/assignment`)
      .set("Authorization", `Bearer ${token(green)}`)
      .send({ busId: soudiaBus.body.data.id });
    expect(cross.status).toBe(403);
    const soudiaAssign = await request(app)
      .patch(`/api/drivers/${created.body.data.id}/assignment`)
      .set("Authorization", `Bearer ${token(soudia)}`)
      .send({ busId: soudiaBus.body.data.id });
    expect(soudiaAssign.status).toBe(403);
    await request(app)
      .patch(`/api/drivers/${created.body.data.id}/assignment`)
      .set("Authorization", `Bearer ${token(green)}`)
      .send({ busId: null });
    await request(app).delete(`/api/drivers/${created.body.data.id}`).set("Authorization", `Bearer ${token(green)}`);
    await request(app).delete(`/api/buses/${bus.body.data.id}`).set("Authorization", `Bearer ${token(green)}`);
    await request(app).delete(`/api/buses/${soudiaBus.body.data.id}`).set("Authorization", `Bearer ${token(soudia)}`);
  });
});
