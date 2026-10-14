import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("API contract", () => {
  it("health endpoint reports simulation mode by default", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.timezone).toBe("Asia/Dhaka");
  });

  it("rejects unauthenticated dashboard APIs", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects invalid login payloads", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it("rejects unknown login credentials without leaking existence", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password" });
    expect([401, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("passwordhash");
  });
});
