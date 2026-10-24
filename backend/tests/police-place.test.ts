import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { cityForPoint } from "../src/utils/policeArea.js";

const app = createApp();
const DEMO_PASSWORD = "Demo@12345";

async function login(email: string) {
  return request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
}

function token(res: { body: { data?: { accessToken?: string } } }) {
  return res.body.data?.accessToken as string;
}

describe("Police place access", () => {
  it("maps coordinates onto the demo cities", () => {
    expect(cityForPoint(23.81, 90.41)).toBe("Dhaka");
    expect(cityForPoint(22.34, 91.82)).toBe("Chattogram");
    expect(cityForPoint(24.89, 91.87)).toBe("Sylhet");
    expect(cityForPoint(24.37, 88.6)).toBe("Rajshahi");
    expect(cityForPoint(22.83, 89.55)).toBe("Khulna");
    expect(cityForPoint(21.4, 92.0)).toBeNull();
  });

  it("shows each police account only the buses and problems of its place", async () => {
    const dhaka = await login("police@nirapad.gov.bd");
    const ctg = await login("police.ctg@nirapad.gov.bd");
    expect(dhaka.status).toBe(200);
    expect(ctg.status).toBe(200);
    expect(dhaka.body.data.user.areas).toEqual(["Dhaka"]);
    expect(ctg.body.data.user.areas).toEqual(["Chattogram"]);

    const dhakaLive = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(dhaka)}`);
    const ctgLive = await request(app).get("/api/gps/live").set("Authorization", `Bearer ${token(ctg)}`);
    const dhakaBuses = await request(app).get("/api/buses?pageSize=100").set("Authorization", `Bearer ${token(dhaka)}`);
    const ctgBuses = await request(app).get("/api/buses?pageSize=100").set("Authorization", `Bearer ${token(ctg)}`);
    expect(dhakaLive.status).toBe(200);
    expect(ctgLive.status).toBe(200);

    const dhakaRegs = (dhakaLive.body.data.items as Array<{ registrationNo: string; city: string }>).map((row) => row.registrationNo);
    const ctgRegs = (ctgLive.body.data.items as Array<{ registrationNo: string; city: string }>).map((row) => row.registrationNo);
    expect(dhakaRegs.length).toBeGreaterThan(0);
    expect(ctgRegs.length).toBeGreaterThan(0);
    expect(dhakaRegs.some((reg) => /^(CTG|SYL|RAJ|KHL)-/.test(reg))).toBe(false);
    expect(ctgRegs.every((reg) => reg.startsWith("CTG"))).toBe(true);
    expect((dhakaLive.body.data.items as Array<{ city: string }>).every((row) => row.city === "Dhaka")).toBe(true);
    expect((ctgLive.body.data.items as Array<{ city: string }>).every((row) => row.city === "Chattogram")).toBe(true);

    const dhakaFleet = (dhakaBuses.body.data.items as Array<{ registrationNo: string }>).map((row) => row.registrationNo);
    const ctgFleet = (ctgBuses.body.data.items as Array<{ registrationNo: string }>).map((row) => row.registrationNo);
    expect(dhakaFleet.some((reg) => reg.startsWith("CTG"))).toBe(false);
    expect(ctgFleet.some((reg) => reg.startsWith("DHAKA"))).toBe(false);

    const dhakaBus = await prisma.bus.findFirst({
      where: { registrationNo: "DHAKA-METRO-D-DEMO-11", deletedAt: null },
      select: { id: true },
    });
    expect(dhakaBus).toBeTruthy();
    const hidden = await request(app).get(`/api/buses/${dhakaBus!.id}`).set("Authorization", `Bearer ${token(ctg)}`);
    expect(hidden.status).toBe(403);

    const alert = await prisma.alert.create({
      data: {
        type: "SYSTEM",
        severity: "LOW",
        status: "OPEN",
        busId: dhakaBus!.id,
        message: `place-scope-${Date.now()}`,
        dataSource: "SIMULATED",
      },
    });
    const denied = await request(app)
      .put(`/api/alerts/${alert.id}/status`)
      .set("Authorization", `Bearer ${token(ctg)}`)
      .send({ status: "ACKNOWLEDGED" });
    const allowed = await request(app)
      .put(`/api/alerts/${alert.id}/status`)
      .set("Authorization", `Bearer ${token(dhaka)}`)
      .send({ status: "ACKNOWLEDGED" });
    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    await prisma.alert.delete({ where: { id: alert.id } });

    const ctgComplaints = await request(app).get("/api/complaints?pageSize=50").set("Authorization", `Bearer ${token(ctg)}`);
    expect(ctgComplaints.status).toBe(200);
    const refs = (ctgComplaints.body.data as Array<{ reference?: string }>).map((row) => row.reference ?? "");
    expect(refs).toContain("CMP-SEED-CTG-001");
    expect(refs.some((ref) => ref.startsWith("CMP-SEED-SYL") || ref.startsWith("CMP-SEED-KHL") || ref === "CMP-SEED-001")).toBe(false);
  });
});
