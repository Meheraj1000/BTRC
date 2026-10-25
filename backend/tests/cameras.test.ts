import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();
const DEMO_PASSWORD = "Demo@12345";

async function login(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  return { status: res.status, token: res.body.data?.accessToken as string | undefined, body: res.body };
}

describe("Street cameras", () => {
  it("shows each police account only the cameras of its place", async () => {
    const dhaka = await login("police@nirapad.gov.bd");
    const ctg = await login("police.ctg@nirapad.gov.bd");
    const government = await login("government@nirapad.gov.bd");
    const passenger = await login("passenger.fatima@demo.bd");
    expect(dhaka.status).toBe(200);
    expect(ctg.status).toBe(200);
    expect(government.status).toBe(200);
    expect(passenger.status).toBe(200);

    const dhakaList = await request(app).get("/api/cameras").set("Authorization", `Bearer ${dhaka.token}`);
    const ctgList = await request(app).get("/api/cameras").set("Authorization", `Bearer ${ctg.token}`);
    const national = await request(app).get("/api/cameras").set("Authorization", `Bearer ${government.token}`);
    const denied = await request(app).get("/api/cameras").set("Authorization", `Bearer ${passenger.token}`);

    expect(dhakaList.status).toBe(200);
    expect(ctgList.status).toBe(200);
    expect(national.status).toBe(200);
    expect(denied.status).toBe(403);

    const dhakaItems = dhakaList.body.data.items as Array<{ id: string; code: string; city: string; streamUrl: string | null }>;
    const ctgItems = ctgList.body.data.items as Array<{ code: string; city: string }>;
    const nationalItems = national.body.data.items as Array<{ city: string }>;
    expect(dhakaItems.length).toBeGreaterThan(0);
    expect(dhakaItems.every((row) => row.city === "Dhaka" && row.streamUrl == null)).toBe(true);
    expect(ctgItems.every((row) => row.city === "Chattogram")).toBe(true);
    expect(dhakaItems.some((row) => row.code.startsWith("CMP-"))).toBe(false);
    expect(ctgItems.some((row) => row.code.startsWith("DMP-"))).toBe(false);
    expect(new Set(nationalItems.map((row) => row.city)).size).toBeGreaterThan(1);

    const hidden = await request(app).get(`/api/cameras/${dhakaItems[0].id}`).set("Authorization", `Bearer ${ctg.token}`);
    expect(hidden.status).toBe(403);

    const watched = await request(app).get(`/api/cameras/${dhakaItems[0].id}`).set("Authorization", `Bearer ${dhaka.token}`);
    expect(watched.status).toBe(200);
    expect(watched.body.data.city).toBe("Dhaka");
    expect(watched.body.data.dataLabel).toBe("SIMULATED");

    const blocked = await request(app)
      .patch(`/api/cameras/${dhakaItems[0].id}`)
      .set("Authorization", `Bearer ${dhaka.token}`)
      .send({ status: "OFFLINE" });
    expect(blocked.status).toBe(403);
  });

  it("matches a plate only inside the officer's place and lists marked vehicles there", async () => {
    const ctg = await login("police.ctg@nirapad.gov.bd");
    const dhaka = await login("police@nirapad.gov.bd");
    const passenger = await login("passenger.fatima@demo.bd");

    const found = await request(app)
      .get("/api/cameras/locate")
      .query({ plate: "ctg metro a demo 31" })
      .set("Authorization", `Bearer ${ctg.token}`);
    expect(found.status).toBe(200);
    expect(found.body.data.found).toBe(true);
    expect(found.body.data.match.registrationNo).toBe("CTG-METRO-A-DEMO-31");
    expect(found.body.data.match.camera.city).toBe("Chattogram");
    expect(found.body.data.match.dataLabel).toBe("SIMULATED");
    expect(found.body.data.match.slot).toBeGreaterThanOrEqual(0);
    expect(found.body.data.match.slot).toBeLessThan(4);

    const hidden = await request(app)
      .get("/api/cameras/locate")
      .query({ plate: "DHAKA-METRO-D-DEMO-11" })
      .set("Authorization", `Bearer ${ctg.token}`);
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.found).toBe(false);

    const otherPlace = await request(app)
      .get("/api/cameras/locate")
      .query({ plate: "CTG-METRO-A-DEMO-31" })
      .set("Authorization", `Bearer ${dhaka.token}`);
    expect(otherPlace.body.data.found).toBe(false);

    const denied = await request(app)
      .get("/api/cameras/locate")
      .query({ plate: "CTG-METRO-A-DEMO-31" })
      .set("Authorization", `Bearer ${passenger.token}`);
    expect(denied.status).toBe(403);

    const marked = await request(app).get("/api/cameras/marked").set("Authorization", `Bearer ${ctg.token}`);
    expect(marked.status).toBe(200);
    const plates = (marked.body.data.items as Array<{ registrationNo: string; camera: { city: string } | null }>).map((row) => row.registrationNo);
    expect(plates).toContain("CTG-METRO-A-DEMO-32");
    expect(plates.some((plate) => plate.startsWith("DHAKA-"))).toBe(false);
    expect(marked.body.data.items.every((row: { camera: { city: string } | null }) => row.camera == null || row.camera.city === "Chattogram")).toBe(true);
  });
});
