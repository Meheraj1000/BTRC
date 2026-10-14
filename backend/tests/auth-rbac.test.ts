import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";

const app = createApp();
const DEMO_PASSWORD = "Demo@12345";

async function login(email: string, password = DEMO_PASSWORD) {
  return request(app).post("/api/auth/login").send({ email, password });
}

function bearer(res: { body: { data?: { accessToken?: string; refreshToken?: string } } }) {
  return {
    access: res.body.data?.accessToken as string,
    refresh: res.body.data?.refreshToken as string,
  };
}

function leak(body: unknown) {
  return JSON.stringify(body).toLowerCase();
}

describe("authentication", () => {
  it("logs in a valid demo account without returning a password hash", async () => {
    const res = await login("passenger.fatima@demo.bd");
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.roles).toContain("PASSENGER");
    expect(leak(res.body)).not.toContain("passwordhash");
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects an invalid password and an unknown account with the same message", async () => {
    const bad = await login("passenger.fatima@demo.bd", "WrongPass1");
    const unknown = await login("nobody-missing@example.com", "WrongPass1");
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.message).toBe(unknown.body.message);
    expect(leak(bad.body)).not.toContain("passwordhash");
  });

  it("rejects an invalid bearer token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
  });

  it("rejects an expired access token", async () => {
    const token = jwt.sign(
      {
        sub: "00000000-0000-0000-0000-000000000001",
        email: "x@y.z",
        name: "X",
        roles: ["PASSENGER"],
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      env.JWT_SECRET,
    );
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("revokes refresh tokens on logout", async () => {
    const auth = await login("driver.rahim@demo.bd");
    expect(auth.status).toBe(200);
    const { access, refresh } = bearer(auth);
    const out = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${access}`);
    expect(out.status).toBe(200);
    const again = await request(app).post("/api/auth/refresh").send({ refreshToken: refresh });
    expect(again.status).toBe(401);
  });

  it("rejects protected endpoints without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("ignores privileged role injection on public registration", async () => {
    const email = `phase04.reg.${Date.now()}@demo.bd`;
    const res = await request(app).post("/api/auth/register").send({
      email,
      password: "Passenger1",
      fullName: "Phase04 Registrant",
      role: "SUPER_ADMIN",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.roles).toEqual(["PASSENGER"]);
    expect(res.body.data.user.roles).not.toContain("SUPER_ADMIN");
    expect(leak(res.body)).not.toContain("passwordhash");
  });
});

describe("RBAC and ownership", () => {
  it("authorizes government monitoring reads", async () => {
    const auth = await login("government@nirapad.gov.bd");
    expect(auth.status).toBe(200);
    const res = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${bearer(auth).access}`);
    expect(res.status).toBe(200);
    const users = await request(app).get("/api/users").set("Authorization", `Bearer ${bearer(auth).access}`);
    expect(users.status).toBe(403);
  });

  it("authorizes a transport owner on their own fleet only", async () => {
    const owner = await login("owner.greenline@demo.bd");
    const admin = await login("admin@nirapad.gov.bd");
    expect(owner.status).toBe(200);
    expect(admin.status).toBe(200);
    const mine = await request(app).get("/api/buses").set("Authorization", `Bearer ${bearer(owner).access}`);
    expect(mine.status).toBe(200);
    const all = await request(app).get("/api/buses?pageSize=100").set("Authorization", `Bearer ${bearer(admin).access}`);
    const ownerCompany = mine.body.data.items[0]?.companyId
      ?? (mine.body.data.items[0]?.company as { id?: string } | undefined)?.id;
    const foreign = (all.body.data.items as Array<{ id: string; companyId?: string; company?: { id?: string } }>)
      .find((b) => (b.companyId ?? b.company?.id) && (b.companyId ?? b.company?.id) !== ownerCompany);
    if (foreign) {
      const denied = await request(app).get(`/api/buses/${foreign.id}`).set("Authorization", `Bearer ${bearer(owner).access}`);
      expect(denied.status).toBe(403);
    }
  });

  it("blocks a passenger from another passenger's complaint", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const fatima = await login("passenger.fatima@demo.bd");
    expect(admin.status).toBe(200);
    expect(fatima.status).toBe(200);
    const list = await request(app).get("/api/complaints").set("Authorization", `Bearer ${bearer(admin).access}`);
    const other = (list.body.data as Array<{ id: string; passengerId: string }>).find(
      (c) => c.passengerId !== fatima.body.data.user.id,
    );
    if (other) {
      const denied = await request(app).get(`/api/complaints/${other.id}`).set("Authorization", `Bearer ${bearer(fatima).access}`);
      expect(denied.status).toBe(403);
    }
  });

  it("does not let a passenger assign privileged roles", async () => {
    const auth = await login("passenger.fatima@demo.bd");
    const res = await request(app)
      .put(`/api/users/${auth.body.data.user.id}/roles`)
      .set("Authorization", `Bearer ${bearer(auth).access}`)
      .send({ roles: ["SUPER_ADMIN"] });
    expect(res.status).toBe(403);
  });

  it("lets super admin assign a non-admin role and rejects last-admin removal", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    expect(admin.status).toBe(200);
    const token = bearer(admin).access;
    const created = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: `phase04.user.${Date.now()}@demo.bd`,
        password: "TempPass1",
        fullName: "Phase04 Temp",
        role: "PASSENGER",
      });
    expect(created.status).toBe(201);
    const promoted = await request(app)
      .put(`/api/users/${created.body.data.id}/roles`)
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["BRTA"] });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data.roles).toEqual(["BRTA"]);

    const strip = await request(app)
      .put(`/api/users/${admin.body.data.user.id}/roles`)
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["PASSENGER"] });
    expect(strip.status).toBe(409);
  });

  it("denies a deactivated account login and existing access tokens", async () => {
    const admin = await login("admin@nirapad.gov.bd");
    const email = `phase04.inactive.${Date.now()}@demo.bd`;
    const created = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${bearer(admin).access}`)
      .send({ email, password: "TempPass1", fullName: "Inactive Probe", role: "PASSENGER" });
    expect(created.status).toBe(201);
    const session = await login(email, "TempPass1");
    expect(session.status).toBe(200);
    const off = await request(app)
      .put(`/api/users/${created.body.data.id}`)
      .set("Authorization", `Bearer ${bearer(admin).access}`)
      .send({ status: "INACTIVE" });
    expect(off.status).toBe(200);
    const deniedLogin = await login(email, "TempPass1");
    expect(deniedLogin.status).toBe(401);
    const deniedMe = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${bearer(session).access}`);
    expect(deniedMe.status).toBe(401);
  });
});
