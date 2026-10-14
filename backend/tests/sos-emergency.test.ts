import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { canJoinSocketRoom } from "../src/utils/socketRooms.js";

const app = createApp();
const DEMO_PASSWORD = "Demo@12345";

async function login(email: string) {
  return request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
}

function token(res: { body: { data?: { accessToken?: string } } }) {
  return res.body.data?.accessToken as string;
}

async function registerPassenger(label: string) {
  const email = `sos.${label}.${Date.now()}.${Math.random().toString(16).slice(2)}@demo.bd`;
  const res = await request(app).post("/api/auth/register").send({
    email,
    password: DEMO_PASSWORD,
    fullName: `SOS ${label}`,
  });
  expect(res.status).toBe(201);
  return token(res);
}

describe("SOS emergency workflow", () => {
  it("rejects unauthenticated SOS create and list", async () => {
    const created = await request(app).post("/api/sos").send({ message: "x" });
    const listed = await request(app).get("/api/sos");
    expect(created.status).toBe(401);
    expect(listed.status).toBe(401);
  });

  it("lets a passenger create SOS without inventing coordinates and blocks IDOR", async () => {
    const a = await registerPassenger("alpha");
    const b = await registerPassenger("beta");
    const created = await request(app)
      .post("/api/sos")
      .set("Authorization", `Bearer ${a}`)
      .send({ message: "Phase 12 location-unavailable test", category: "SAFETY" });
    expect(created.status).toBe(201);
    expect(created.body.data.locationAvailable).toBe(false);
    expect(created.body.data.latitude).toBeNull();
    expect(created.body.data.longitude).toBeNull();
    expect(created.body.data.internalNote).toBeNull();
    expect(created.body.data.requesterName).toBeNull();
    expect(JSON.stringify(created.body.data)).not.toMatch(/email|phone|password/i);

    const id = created.body.data.id as string;
    const other = await request(app).get(`/api/sos/${id}`).set("Authorization", `Bearer ${b}`);
    expect(other.status).toBe(403);

    const mine = await request(app).get(`/api/sos/${id}`).set("Authorization", `Bearer ${a}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.id).toBe(id);
    expect(mine.body.data.internalNote).toBeNull();
  });

  it("reuses an active SOS instead of creating duplicates", async () => {
    const auth = await registerPassenger("dup");
    const key = randomUUID();
    const first = await request(app)
      .post("/api/sos")
      .set("Authorization", `Bearer ${auth}`)
      .send({ message: "duplicate-one", idempotencyKey: key, latitude: 23.81, longitude: 90.41 });
    const second = await request(app)
      .post("/api/sos")
      .set("Authorization", `Bearer ${auth}`)
      .send({ message: "duplicate-two", idempotencyKey: key, latitude: 23.82, longitude: 90.42 });
    const third = await request(app)
      .post("/api/sos")
      .set("Authorization", `Bearer ${auth}`)
      .send({ message: "duplicate-three", latitude: 23.83, longitude: 90.43 });
    expect(first.status).toBe(201);
    expect(first.body.data.locationAvailable).toBe(true);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.existing).toBe(true);
    expect(third.body.data.id).toBe(first.body.data.id);
    expect(third.body.data.existing).toBe(true);
  });

  it("lets the requester cancel only an OPEN SOS and records audit/notification", async () => {
    const auth = await registerPassenger("cancel");
    const created = await request(app)
      .post("/api/sos")
      .set("Authorization", `Bearer ${auth}`)
      .send({ message: "cancel-me", latitude: 23.75, longitude: 90.39 });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const cancel = await request(app).post(`/api/sos/${id}/cancel`).set("Authorization", `Bearer ${auth}`).send({});
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe("CANCELLED");
    const again = await request(app).post(`/api/sos/${id}/cancel`).set("Authorization", `Bearer ${auth}`).send({});
    expect(again.status).toBe(422);
    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${auth}`);
    expect(notes.status).toBe(200);
    const bodies = JSON.stringify(notes.body.data);
    expect(bodies).toMatch(/SOS/);
    expect(bodies).not.toMatch(/23\.75/);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const audit = await prisma.auditLog.findFirst({ where: { action: "sos.create", entityId: id } });
    expect(audit).toBeTruthy();
  });

  it("enforces monitor status transitions and hides internal notes from passengers", async () => {
    const passenger = await registerPassenger("flow");
    const police = await login("police@nirapad.gov.bd");
    const owner = await login("owner.greenline@demo.bd");
    const created = await request(app)
      .post("/api/sos")
      .set("Authorization", `Bearer ${passenger}`)
      .send({ message: "workflow", latitude: 23.81, longitude: 90.41 });
    const id = created.body.data.id as string;

    const passengerResolve = await request(app)
      .put(`/api/sos/${id}/status`)
      .set("Authorization", `Bearer ${passenger}`)
      .send({ status: "RESOLVED" });
    expect(passengerResolve.status).toBe(403);

    const ownerList = await request(app).get("/api/sos").set("Authorization", `Bearer ${token(owner)}`);
    expect(ownerList.status).toBe(403);

    const illegal = await request(app)
      .put(`/api/sos/${id}/status`)
      .set("Authorization", `Bearer ${token(police)}`)
      .send({ status: "CLOSED" });
    expect(illegal.status).toBe(422);

    const ack = await request(app)
      .put(`/api/sos/${id}/status`)
      .set("Authorization", `Bearer ${token(police)}`)
      .send({ status: "ACKNOWLEDGED" });
    expect(ack.status).toBe(200);
    expect(ack.body.data.status).toBe("ACKNOWLEDGED");
    expect(ack.body.data.requesterName).toBeTruthy();
    expect(JSON.stringify(ack.body.data)).not.toMatch(/@demo\.bd|"phone"/i);

    const note = await request(app)
      .put(`/api/sos/${id}/note`)
      .set("Authorization", `Bearer ${token(police)}`)
      .send({ internalNote: "Internal monitor note" });
    expect(note.status).toBe(200);
    expect(note.body.data.internalNote).toBe("Internal monitor note");

    const passengerView = await request(app).get(`/api/sos/${id}`).set("Authorization", `Bearer ${passenger}`);
    expect(passengerView.body.data.internalNote).toBeNull();
    expect(passengerView.body.data.requesterName).toBeNull();

    const passengerNote = await request(app)
      .put(`/api/sos/${id}/note`)
      .set("Authorization", `Bearer ${passenger}`)
      .send({ internalNote: "should fail" });
    expect(passengerNote.status).toBe(403);

    const passengerList = await request(app).get("/api/sos?page=1&pageSize=5").set("Authorization", `Bearer ${passenger}`);
    expect(passengerList.status).toBe(200);
    expect(passengerList.body.data).toHaveProperty("items");
    expect(passengerList.body.data.items.length).toBeLessThanOrEqual(5);
    for (const row of passengerList.body.data.items as Array<{ requesterName?: string | null; internalNote?: string | null }>) {
      expect(row.requesterName).toBeNull();
      expect(row.internalNote).toBeNull();
    }
  });

  it("lets police page SOS records and keeps BRTA off the SOS desk", async () => {
    const police = await login("police@nirapad.gov.bd");
    const brta = await login("brta@nirapad.gov.bd");
    const listed = await request(app).get("/api/sos?page=1&pageSize=5").set("Authorization", `Bearer ${token(police)}`);
    const denied = await request(app).get("/api/sos").set("Authorization", `Bearer ${token(brta)}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.items.length).toBeLessThanOrEqual(5);
    expect(listed.body.data).toHaveProperty("total");
    expect(denied.status).toBe(403);
  });

  it("lets government list SOS and allows a new SOS after cancel with the same idempotency key", async () => {
    const gov = await login("government@nirapad.gov.bd");
    const listed = await request(app).get("/api/sos?page=1&pageSize=5").set("Authorization", `Bearer ${token(gov)}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveProperty("items");

    const auth = await registerPassenger("recreate");
    const key = randomUUID();
    const first = await request(app)
      .post("/api/sos")
      .set("Authorization", `Bearer ${auth}`)
      .send({ message: "first", idempotencyKey: key });
    expect(first.status).toBe(201);
    const id = first.body.data.id as string;
    const cancel = await request(app).post(`/api/sos/${id}/cancel`).set("Authorization", `Bearer ${auth}`).send({});
    expect(cancel.status).toBe(200);
    const second = await request(app)
      .post("/api/sos")
      .set("Authorization", `Bearer ${auth}`)
      .send({ message: "second", idempotencyKey: key, latitude: 23.7, longitude: 90.4 });
    expect(second.status).toBe(201);
    expect(second.body.data.id).not.toBe(id);
    expect(second.body.data.existing).toBe(false);
  });

  it("does not allow a passenger socket onto another user's emergency room", () => {
    expect(canJoinSocketRoom("user:someone-else", { sub: "passenger-1", roles: ["PASSENGER"] })).toBe(false);
    expect(canJoinSocketRoom("role:POLICE", { sub: "passenger-1", roles: ["PASSENGER"] })).toBe(false);
    expect(canJoinSocketRoom("user:passenger-1", { sub: "passenger-1", roles: ["PASSENGER"] })).toBe(true);
  });
});
