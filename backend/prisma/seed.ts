import {
  AlertType,
  ComplaintCategory,
  GpsDataSource,
  PrismaClient,
  RoleCode,
  VehicleType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

function newQrToken() {
  return randomBytes(12).toString("hex");
}

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Demo@12345";

type Point = { lat: number; lng: number };

const ROUTES: Array<{
  code: string;
  name: string;
  city: string;
  startName: string;
  endName: string;
  allowedSpeed: number;
  polyline: Point[];
  stops: Array<{ name: string; sequence: number }>;
}> = [
  {
    code: "DHK-01",
    name: "Motijheel – Uttara (Demo)",
    city: "Dhaka",
    startName: "Motijheel",
    endName: "Uttara Sector 7",
    allowedSpeed: 40,
    polyline: [
      { lat: 23.7331, lng: 90.4172 }, // Motijheel
      { lat: 23.7382, lng: 90.3955 }, // Shahbagh
      { lat: 23.7512, lng: 90.3908 }, // Kawran Bazar
      { lat: 23.7563, lng: 90.3872 }, // Farmgate
      { lat: 23.7698, lng: 90.3986 }, // Tejgaon
      { lat: 23.7806, lng: 90.4043 }, // Mohakhali
      { lat: 23.7940, lng: 90.4045 }, // Banani
      { lat: 23.8155, lng: 90.4038 }, // Airport Road
      { lat: 23.8468, lng: 90.3892 }, // House Building
      { lat: 23.8721, lng: 90.3832 }, // Uttara Sector 7
    ],
    stops: [
      { name: "Motijheel", sequence: 1 },
      { name: "Shahbagh", sequence: 2 },
      { name: "Farmgate", sequence: 3 },
      { name: "Mohakhali", sequence: 4 },
      { name: "Banani", sequence: 5 },
      { name: "Uttara", sequence: 6 },
    ],
  },
  {
    code: "DHK-02",
    name: "Gabtoli – Sayedabad (Demo)",
    city: "Dhaka",
    startName: "Gabtoli",
    endName: "Sayedabad",
    allowedSpeed: 35,
    polyline: [
      { lat: 23.7825, lng: 90.3438 }, // Gabtoli
      { lat: 23.7758, lng: 90.3556 }, // Technical
      { lat: 23.7688, lng: 90.3648 }, // Kallyanpur
      { lat: 23.7558, lng: 90.3715 }, // Shyamoli
      { lat: 23.7465, lng: 90.3760 }, // Dhanmondi 27
      { lat: 23.7308, lng: 90.4012 }, // Motijheel approach
      { lat: 23.7108, lng: 90.4264 }, // Sayedabad
    ],
    stops: [
      { name: "Gabtoli", sequence: 1 },
      { name: "Technical", sequence: 2 },
      { name: "Kallyanpur", sequence: 3 },
      { name: "Dhanmondi 27", sequence: 4 },
      { name: "Sayedabad", sequence: 5 },
    ],
  },
  {
    code: "DHK-03",
    name: "Gulshan – Dhanmondi (Demo)",
    city: "Dhaka",
    startName: "Gulshan 2",
    endName: "Dhanmondi 27",
    allowedSpeed: 30,
    polyline: [
      { lat: 23.7948, lng: 90.4144 }, // Gulshan 2
      { lat: 23.7806, lng: 90.4043 }, // Mohakhali
      { lat: 23.7510, lng: 90.3928 }, // Panthapath
      { lat: 23.7465, lng: 90.3760 }, // Dhanmondi 27
    ],
    stops: [
      { name: "Gulshan 2", sequence: 1 },
      { name: "Mohakhali", sequence: 2 },
      { name: "Panthapath", sequence: 3 },
      { name: "Dhanmondi 27", sequence: 4 },
    ],
  },
  {
    code: "DHK-04",
    name: "Mirpur 10 – Motijheel (Demo)",
    city: "Dhaka",
    startName: "Mirpur 10",
    endName: "Motijheel",
    allowedSpeed: 40,
    polyline: [
      { lat: 23.8071, lng: 90.3686 }, // Mirpur 10
      { lat: 23.7975, lng: 90.3738 }, // Kazipara
      { lat: 23.7752, lng: 90.3805 }, // Shewrapara / Agargaon
      { lat: 23.7563, lng: 90.3872 }, // Farmgate
      { lat: 23.7382, lng: 90.3955 }, // Shahbagh
      { lat: 23.7331, lng: 90.4172 }, // Motijheel
    ],
    stops: [
      { name: "Mirpur 10", sequence: 1 },
      { name: "Kazipara", sequence: 2 },
      { name: "Farmgate", sequence: 3 },
      { name: "Shahbagh", sequence: 4 },
      { name: "Motijheel", sequence: 5 },
    ],
  },
  {
    code: "CTG-05",
    name: "Agrabad – CU (Demo)",
    city: "Chattogram",
    startName: "Agrabad",
    endName: "Chittagong University",
    allowedSpeed: 45,
    polyline: [
      { lat: 22.3245, lng: 91.8119 }, // Agrabad
      { lat: 22.3418, lng: 91.8225 }, // GEC approach
      { lat: 22.3591, lng: 91.8215 }, // GEC Circle
      { lat: 22.3712, lng: 91.8180 }, // Muradpur
      { lat: 22.4716, lng: 91.7877 }, // CU Gate
    ],
    stops: [
      { name: "Agrabad", sequence: 1 },
      { name: "GEC Circle", sequence: 2 },
      { name: "Muradpur", sequence: 3 },
      { name: "CU Gate", sequence: 4 },
    ],
  },
  {
    code: "SYL-06",
    name: "Amberkhana – South Surma (Demo)",
    city: "Sylhet",
    startName: "Amberkhana",
    endName: "South Surma",
    allowedSpeed: 40,
    polyline: [
      { lat: 24.9015, lng: 91.8687 }, // Amberkhana
      { lat: 24.8948, lng: 91.8682 }, // Zindabazar
      { lat: 24.8695, lng: 91.8718 }, // South Surma
    ],
    stops: [
      { name: "Amberkhana", sequence: 1 },
      { name: "Zindabazar", sequence: 2 },
      { name: "South Surma", sequence: 3 },
    ],
  },
  {
    code: "RAJ-07",
    name: "Shaheb Bazar – RU (Demo)",
    city: "Rajshahi",
    startName: "Shaheb Bazar",
    endName: "Rajshahi University",
    allowedSpeed: 40,
    polyline: [
      { lat: 24.3745, lng: 88.6042 }, // Shaheb Bazar
      { lat: 24.3708, lng: 88.6168 }, // New Market
      { lat: 24.3700, lng: 88.6375 }, // RU Campus
    ],
    stops: [
      { name: "Shaheb Bazar", sequence: 1 },
      { name: "New Market", sequence: 2 },
      { name: "RU Campus", sequence: 3 },
    ],
  },
  {
    code: "KHL-08",
    name: "Sonadanga – Rupsha (Demo)",
    city: "Khulna",
    startName: "Sonadanga",
    endName: "Rupsha",
    allowedSpeed: 40,
    polyline: [
      { lat: 22.8456, lng: 89.5403 }, // Sonadanga
      { lat: 22.8318, lng: 89.5488 }, // Shibbari
      { lat: 22.8165, lng: 89.5608 }, // Rupsha
    ],
    stops: [
      { name: "Sonadanga", sequence: 1 },
      { name: "Shibbari", sequence: 2 },
      { name: "Rupsha", sequence: 3 },
    ],
  },
];

const PERMISSIONS = [
  ["users.manage", "Manage users"],
  ["roles.manage", "Manage roles"],
  ["buses.manage", "Manage buses"],
  ["buses.read", "Read buses"],
  ["buses.verify", "Manual / simulated vehicle verification"],
  ["drivers.manage", "Manage drivers"],
  ["drivers.read", "Read drivers"],
  ["drivers.verify", "Manual / simulated driver license verification"],
  ["companies.manage", "Manage companies"],
  ["companies.read", "Read companies"],
  ["routes.manage", "Manage routes"],
  ["routes.read", "Read routes"],
  ["gps.manage", "Manage GPS devices"],
  ["gps.ingest", "Ingest GPS"],
  ["trips.manage", "Manage trips"],
  ["trips.own", "Own trips"],
  ["alerts.read", "Read alerts"],
  ["alerts.manage", "Manage alerts"],
  ["sos.read", "Read SOS"],
  ["sos.create", "Create SOS"],
  ["sos.manage", "Manage SOS"],
  ["complaints.create", "Create complaints"],
  ["complaints.read", "Read complaints"],
  ["complaints.manage", "Manage complaints"],
  ["complaints.note", "Add complaint notes"],
  ["lostfound.create", "Create lost/found reports"],
  ["lostfound.read", "Read lost/found reports"],
  ["lostfound.manage", "Manage lost/found reports"],
  ["lostfound.claim", "Claim lost/found items"],
  ["analytics.read", "Read analytics"],
  ["reports.read", "Read reports"],
  ["settings.manage", "Manage settings"],
  ["audit.read", "Read audit logs"],
  ["simulator.control", "Control GPS simulator"],
  ["notifications.read", "Read notifications"],
] as const;

async function main() {
  console.log("Seeding Nirapad Transit demo data (SIMULATED / DEMO — not government records)...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const [code, name] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }

  const roleNames: Record<RoleCode, string> = {
    SUPER_ADMIN: "Super Admin",
    GOVERNMENT: "Government Authority",
    BRTA: "BRTA Authority",
    POLICE: "Police / Law Enforcement",
    TRANSPORT_OWNER: "Transport Company / Bus Owner",
    DRIVER: "Bus Driver",
    PASSENGER: "Passenger",
  };

  const roles = {} as Record<RoleCode, { id: string }>;
  for (const code of Object.keys(roleNames) as RoleCode[]) {
    roles[code] = await prisma.role.upsert({
      where: { code },
      update: { name: roleNames[code] },
      create: { code, name: roleNames[code], description: `${roleNames[code]} (demo role)` },
    });
  }

  const allPerms = await prisma.permission.findMany();
  const { ROLE_PERMISSIONS } = await import("../src/utils/permissions.js");
  for (const code of Object.keys(ROLE_PERMISSIONS) as RoleCode[]) {
    const allowed = new Set(ROLE_PERMISSIONS[code]);
    await prisma.rolePermission.deleteMany({ where: { roleId: roles[code].id } });
    await prisma.rolePermission.createMany({
      data: allPerms.filter((p) => allowed.has(p.code as never)).map((p) => ({
        roleId: roles[code].id,
        permissionId: p.id,
      })),
    });
  }

  async function upsertUser(email: string, fullName: string, role: RoleCode, phone?: string) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { fullName, passwordHash, status: "ACTIVE" },
      create: { email, fullName, passwordHash, phone, status: "ACTIVE" },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[role].id } },
      update: {},
      create: { userId: user.id, roleId: roles[role].id },
    });
    return user;
  }

  async function assignPlace(userId: string, city: string) {
    await prisma.policeArea.upsert({
      where: { userId_city: { userId, city } },
      update: {},
      create: { userId, city },
    });
  }

  const admin = await upsertUser("admin@nirapad.gov.bd", "System Administrator", "SUPER_ADMIN", "01711000001");
  await upsertUser("government@nirapad.gov.bd", "Ministry Observer (Demo)", "GOVERNMENT", "01711000002");
  await upsertUser("brta@nirapad.gov.bd", "BRTA Desk Officer (Demo)", "BRTA", "01711000003");
  const policeDhaka = await upsertUser("police@nirapad.gov.bd", "DMP Control Room (Demo)", "POLICE", "01711000004");
  const policeCtg = await upsertUser("police.ctg@nirapad.gov.bd", "CMP Control Room (Demo)", "POLICE", "01711000005");
  const policeSylhet = await upsertUser("police.sylhet@nirapad.gov.bd", "SMP Control Room (Demo)", "POLICE", "01711000006");
  const policeRajshahi = await upsertUser("police.rajshahi@nirapad.gov.bd", "RMP Control Room (Demo)", "POLICE", "01711000007");
  const policeKhulna = await upsertUser("police.khulna@nirapad.gov.bd", "KMP Control Room (Demo)", "POLICE", "01711000008");
  await assignPlace(policeDhaka.id, "Dhaka");
  await assignPlace(policeCtg.id, "Chattogram");
  await assignPlace(policeSylhet.id, "Sylhet");
  await assignPlace(policeRajshahi.id, "Rajshahi");
  await assignPlace(policeKhulna.id, "Khulna");

  const owner1 = await upsertUser("owner.greenline@demo.bd", "Green Line Owner (Demo)", "TRANSPORT_OWNER", "01711000011");
  const owner2 = await upsertUser("owner.soudia@demo.bd", "Soudia Owner (Demo)", "TRANSPORT_OWNER", "01711000012");

  const company1 = await prisma.transportCompany.upsert({
    where: { registration: "DEMO-GL-001" },
    update: { ownerUserId: owner1.id },
    create: {
      name: "Green Line Paribahan (Demo)",
      registration: "DEMO-GL-001",
      phone: "01711000011",
      email: "owner.greenline@demo.bd",
      address: "Mohakhali, Dhaka",
      city: "Dhaka",
      ownerUserId: owner1.id,
    },
  });
  const company2 = await prisma.transportCompany.upsert({
    where: { registration: "DEMO-SD-002" },
    update: { ownerUserId: owner2.id },
    create: {
      name: "Soudia Coach (Demo)",
      registration: "DEMO-SD-002",
      phone: "01711000012",
      email: "owner.soudia@demo.bd",
      address: "Gabtoli, Dhaka",
      city: "Dhaka",
      ownerUserId: owner2.id,
    },
  });
  const company3 = await prisma.transportCompany.upsert({
    where: { registration: "DEMO-NL-003" },
    update: {},
    create: {
      name: "Nabil Paribahan (Demo)",
      registration: "DEMO-NL-003",
      phone: "01711000013",
      city: "Chattogram",
    },
  });

  const routeRows = [];
  for (const r of ROUTES) {
    const created = await prisma.route.upsert({
      where: { code: r.code },
      update: { polyline: r.polyline, isDemo: true },
      create: {
        code: r.code,
        name: r.name,
        startName: r.startName,
        endName: r.endName,
        startLat: r.polyline[0].lat,
        startLng: r.polyline[0].lng,
        endLat: r.polyline[r.polyline.length - 1].lat,
        endLng: r.polyline[r.polyline.length - 1].lng,
        city: r.city,
        allowedSpeed: r.allowedSpeed,
        polyline: r.polyline,
        isDemo: true,
        companyId: r.city === "Chattogram" ? company3.id : company1.id,
        stops: {
          create: r.stops.map((s, i) => {
            const pt = r.polyline[Math.min(i, r.polyline.length - 1)];
            return { name: s.name, sequence: s.sequence, latitude: pt.lat, longitude: pt.lng };
          }),
        },
      },
    });
    routeRows.push(created);
  }

  const driverSpecs = [
    ["Rahim Uddin", "driver.rahim@demo.bd", "DL-DEMO-1001", company1.id],
    ["Karim Mia", "driver.karim@demo.bd", "DL-DEMO-1002", company1.id],
    ["Abdul Jalil", "driver.jalil@demo.bd", "DL-DEMO-1003", company1.id],
    ["Shahidul Islam", "driver.shahid@demo.bd", "DL-DEMO-1004", company1.id],
    ["Nurul Amin", "driver.nurul@demo.bd", "DL-DEMO-1005", company2.id],
    ["Faruk Hossain", "driver.faruk@demo.bd", "DL-DEMO-1006", company2.id],
    ["Mizanur Rahman", "driver.mizan@demo.bd", "DL-DEMO-1007", company2.id],
    ["Alamgir Kabir", "driver.alamgir@demo.bd", "DL-DEMO-1008", company3.id],
    ["Rafiqul Hasan", "driver.rafiq@demo.bd", "DL-DEMO-1009", company3.id],
    ["Jamal Uddin", "driver.jamal@demo.bd", "DL-DEMO-1010", company1.id],
    ["Sajjad Hossain", "driver.sajjad@demo.bd", "DL-DEMO-1011", company1.id],
    ["Tariqul Islam", "driver.tariq@demo.bd", "DL-DEMO-1012", company2.id],
  ] as const;

  const drivers = [];
  for (let i = 0; i < driverSpecs.length; i += 1) {
    const [name, email, license, companyId] = driverSpecs[i];
    const user = await upsertUser(email, `${name} (Demo)`, "DRIVER", `01711${String(200001 + i).padStart(6, "0")}`);
    const driver = await prisma.driver.upsert({
      where: { licenseNumber: license },
      update: { userId: user.id, companyId },
      create: {
        userId: user.id,
        companyId,
        licenseNumber: license,
        licenseStatus: "VALID",
        licenseExpiry: new Date("2027-12-31"),
        experienceYears: 5 + Math.floor(Math.random() * 15),
        performanceScore: 70 + Math.floor(Math.random() * 25),
        nidReference: "DEMO-NID-REDACTED",
      },
    });
    drivers.push(driver);
  }

  const busRegs = [
    ["DHAKA-METRO-D-DEMO-11", company1.id, 0, VehicleType.AC_BUS],
    ["DHAKA-METRO-D-DEMO-12", company1.id, 0, VehicleType.STANDARD_BUS],
    ["DHAKA-METRO-D-DEMO-13", company1.id, 1, VehicleType.STANDARD_BUS],
    ["DHAKA-METRO-D-DEMO-14", company1.id, 1, VehicleType.MINIBUS],
    ["DHAKA-METRO-D-DEMO-15", company1.id, 2, VehicleType.AC_BUS],
    ["DHAKA-METRO-D-DEMO-16", company1.id, 3, VehicleType.STANDARD_BUS],
    ["DHAKA-METRO-GA-DEMO-21", company2.id, 3, VehicleType.STANDARD_BUS],
    ["DHAKA-METRO-GA-DEMO-22", company2.id, 2, VehicleType.MINIBUS],
    ["DHAKA-METRO-GA-DEMO-23", company2.id, 1, VehicleType.STANDARD_BUS],
    ["CTG-METRO-A-DEMO-31", company3.id, 4, VehicleType.STANDARD_BUS],
    ["CTG-METRO-A-DEMO-32", company3.id, 4, VehicleType.AC_BUS],
    ["SYL-DEMO-41", company1.id, 5, VehicleType.MINIBUS],
    ["RAJ-DEMO-51", company2.id, 6, VehicleType.STANDARD_BUS],
    ["KHL-DEMO-61", company3.id, 7, VehicleType.STANDARD_BUS],
    ["DHAKA-METRO-D-DEMO-17", company1.id, 0, VehicleType.STANDARD_BUS],
    ["DHAKA-METRO-D-DEMO-18", company1.id, 2, VehicleType.AC_BUS],
  ] as const;

  const buses = [];
  for (let i = 0; i < busRegs.length; i += 1) {
    const [reg, companyId, routeIdx, type] = busRegs[i];
    const device = await prisma.gpsDevice.upsert({
      where: { serialNumber: `SIM-GPS-${String(i + 1).padStart(3, "0")}` },
      update: {},
      create: {
        serialNumber: `SIM-GPS-${String(i + 1).padStart(3, "0")}`,
        vendor: "DemoSim",
        firmware: "sim-1.0",
        dataSource: GpsDataSource.SIMULATION,
        notes: "Development simulator device — not a physical tracker",
      },
    });
    const driver = drivers[i % drivers.length];
    const route = routeRows[routeIdx];
    const bus = await prisma.bus.upsert({
      where: { registrationNo: reg },
      update: { routeId: route.id, driverId: driver.id, gpsDeviceId: device.id, operationalStatus: "ACTIVE" },
      create: {
        registrationNo: reg,
        qrToken: newQrToken(),
        vehicleType: type,
        manufacturer: i % 2 === 0 ? "Hino" : "Ashok Leyland",
        model: "Demo Fleet",
        capacity: type === "MINIBUS" ? 24 : 40,
        companyId,
        routeId: route.id,
        driverId: driver.id,
        gpsDeviceId: device.id,
        fitnessStatus: "FIT",
        registrationStatus: "ACTIVE",
        insuranceStatus: "VALID",
        operationalStatus: "ACTIVE",
        yearOfManufacture: 2018 + (i % 6),
      },
    });
    // Demo buses always have a scannable QR (create path sets it; update path backfills if missing).
    const ensured = bus.qrToken
      ? bus
      : await prisma.bus.update({
          where: { id: bus.id },
          data: { qrToken: newQrToken() },
        });
    buses.push({ bus: ensured, route, driver, device });
  }

  const extraFleet = [
    ["CTG-METRO-A-DEMO-33", company3.id, "CTG-05"],
    ["CTG-METRO-A-DEMO-34", company3.id, "CTG-05"],
    ["SYL-DEMO-42", company1.id, "SYL-06"],
    ["SYL-DEMO-43", company1.id, "SYL-06"],
    ["RAJ-DEMO-52", company2.id, "RAJ-07"],
    ["RAJ-DEMO-53", company2.id, "RAJ-07"],
    ["KHL-DEMO-62", company3.id, "KHL-08"],
    ["KHL-DEMO-63", company3.id, "KHL-08"],
  ] as const;
  for (let i = 0; i < extraFleet.length; i += 1) {
    const [reg, companyId, routeCode] = extraFleet[i];
    const route = routeRows.find((row) => row.code === routeCode);
    if (!route) continue;
    const driver = drivers[i % drivers.length];
    const device = await prisma.gpsDevice.upsert({
      where: { serialNumber: `SIM-GPS-P${String(i + 1).padStart(2, "0")}` },
      update: {},
      create: {
        serialNumber: `SIM-GPS-P${String(i + 1).padStart(2, "0")}`,
        vendor: "DemoSim",
        firmware: "sim-1.0",
        dataSource: GpsDataSource.SIMULATION,
        notes: "Place-scoped demo tracker — not a physical device",
      },
    });
    const bus = await prisma.bus.upsert({
      where: { registrationNo: reg },
      update: { routeId: route.id, driverId: driver.id, gpsDeviceId: device.id, companyId, operationalStatus: "ACTIVE" },
      create: {
        registrationNo: reg,
        qrToken: newQrToken(),
        vehicleType: i % 2 === 0 ? VehicleType.STANDARD_BUS : VehicleType.MINIBUS,
        manufacturer: "Hino",
        model: "Demo Fleet",
        capacity: 36,
        companyId,
        routeId: route.id,
        driverId: driver.id,
        gpsDeviceId: device.id,
        fitnessStatus: "FIT",
        registrationStatus: "ACTIVE",
        insuranceStatus: "VALID",
        operationalStatus: "ACTIVE",
        yearOfManufacture: 2019,
      },
    });
    const poly = route.polyline as unknown as Point[];
    const pt = poly[Math.min(i, poly.length - 1)];
    await prisma.gpsLatestLocation.upsert({
      where: { busId: bus.id },
      update: { latitude: pt.lat, longitude: pt.lng, routeId: route.id, timestamp: new Date() },
      create: {
        busId: bus.id,
        deviceId: device.id,
        routeId: route.id,
        driverId: driver.id,
        latitude: pt.lat,
        longitude: pt.lng,
        speed: 22,
        heading: 90,
        timestamp: new Date(),
        source: "SIMULATION",
      },
    });
    buses.push({ bus, route, driver, device });
  }

  for (const { bus, route, driver } of buses) {
    const poly = route.polyline as unknown as Point[];
    const idx = Math.floor(Math.random() * poly.length);
    const pt = poly[idx];
    await prisma.gpsLatestLocation.upsert({
      where: { busId: bus.id },
      update: { latitude: pt.lat, longitude: pt.lng, timestamp: new Date() },
      create: {
        busId: bus.id,
        deviceId: bus.gpsDeviceId,
        routeId: route.id,
        driverId: driver.id,
        latitude: pt.lat,
        longitude: pt.lng,
        speed: 18 + Math.random() * 20,
        heading: 90,
        timestamp: new Date(),
        source: "SIMULATION",
      },
    });
  }

  const passengerUser = await upsertUser("passenger.fatima@demo.bd", "Fatima Akter (Demo)", "PASSENGER", "01711000090");
  await prisma.passenger.upsert({
    where: { userId: passengerUser.id },
    update: {},
    create: { userId: passengerUser.id, emergencyName: "Demo Contact", emergencyContact: "01711000099" },
  });
  const passenger2 = await upsertUser("passenger.arif@demo.bd", "Arif Chowdhury (Demo)", "PASSENGER", "01711000091");
  await prisma.passenger.upsert({
    where: { userId: passenger2.id },
    update: {},
    create: { userId: passenger2.id },
  });
  /** System passenger used when a QR emergency is sent without sign-in. */
  const qrEmergencyUser = await upsertUser(
    "qr.emergency@nirapad.gov.bd",
    "QR Emergency Reporter (System)",
    "PASSENGER",
  );
  await prisma.passenger.upsert({
    where: { userId: qrEmergencyUser.id },
    update: {},
    create: { userId: qrEmergencyUser.id, emergencyName: "System", emergencyContact: "N/A" },
  });

  await prisma.complaint.upsert({
    where: { reference: "CMP-SEED-001" },
    update: {},
    create: {
      passengerId: passengerUser.id,
      busId: buses[0].bus.id,
      reference: "CMP-SEED-001",
      category: ComplaintCategory.OVERSPEEDING,
      subject: "Overspeeding complaint",
      description: "Demo complaint: bus appeared to exceed the posted limit near Farmgate.",
      status: "PENDING",
    },
  });
  await prisma.complaint.upsert({
    where: { reference: "CMP-SEED-002" },
    update: {},
    create: {
      passengerId: passenger2.id,
      busId: buses[2].bus.id,
      reference: "CMP-SEED-002",
      category: ComplaintCategory.BUS_CONDITION,
      subject: "Bus condition complaint",
      description: "Demo complaint: AC was not working on a marked AC bus.",
      status: "UNDER_REVIEW",
    },
  });

  const systemMessage = "Demo environment initialized. GPS feed is SIMULATION unless GPS_SOURCE_MODE=DEVICE.";
  const systemAlert = await prisma.alert.findFirst({ where: { message: systemMessage } });
  if (!systemAlert) {
    await prisma.alert.create({
      data: {
        type: AlertType.SYSTEM,
        severity: "LOW",
        message: systemMessage,
        dataSource: "SIMULATED",
      },
    });
  }

  async function busByReg(registrationNo: string) {
    return prisma.bus.findUnique({ where: { registrationNo }, select: { id: true, routeId: true, driverId: true } });
  }
  async function ensureAlert(message: string, registrationNo: string, type: AlertType) {
    const bus = await busByReg(registrationNo);
    if (!bus) return;
    const existing = await prisma.alert.findFirst({ where: { message, busId: bus.id } });
    if (existing) return;
    await prisma.alert.create({
      data: {
        type,
        severity: "HIGH",
        status: "OPEN",
        busId: bus.id,
        routeId: bus.routeId,
        driverId: bus.driverId,
        message,
        dataSource: "SIMULATED",
      },
    });
  }
  async function ensureComplaint(reference: string, registrationNo: string, subject: string, description: string) {
    const bus = await busByReg(registrationNo);
    if (!bus) return;
    await prisma.complaint.upsert({
      where: { reference },
      update: { status: "PENDING", busId: bus.id, routeId: bus.routeId },
      create: {
        passengerId: passengerUser.id,
        busId: bus.id,
        routeId: bus.routeId,
        reference,
        category: ComplaintCategory.DRIVER_BEHAVIOR,
        subject,
        description,
        status: "PENDING",
      },
    });
  }
  async function ensureSos(message: string, registrationNo: string) {
    const bus = await busByReg(registrationNo);
    if (!bus) return;
    const existing = await prisma.sosRequest.findFirst({ where: { message, busId: bus.id } });
    if (existing) return;
    await prisma.sosRequest.create({
      data: {
        userId: passengerUser.id,
        roleHint: "PASSENGER",
        busId: bus.id,
        routeId: bus.routeId,
        driverId: bus.driverId,
        message,
        status: "OPEN",
        locationSource: "VEHICLE",
      },
    });
  }

  await ensureAlert("Demo Dhaka: open route deviation near Farmgate", "DHAKA-METRO-D-DEMO-16", AlertType.ROUTE_DEVIATION);
  await ensureSos("Demo Dhaka SOS: passenger requested help near Shahbagh", "DHAKA-METRO-D-DEMO-13");
  await ensureComplaint("CMP-SEED-CTG-001", "CTG-METRO-A-DEMO-31", "Overcrowding near GEC", "Demo complaint: the Chattogram bus was overcrowded near GEC Circle.");
  await ensureAlert("Demo Chattogram: bus left the assigned road", "CTG-METRO-A-DEMO-32", AlertType.ROUTE_DEVIATION);
  await ensureSos("Demo Chattogram SOS: help requested on Agrabad road", "CTG-METRO-A-DEMO-33");
  await ensureAlert("Demo Sylhet: speed above the route limit", "SYL-DEMO-41", AlertType.OVERSPEED);
  await ensureComplaint("CMP-SEED-SYL-001", "SYL-DEMO-42", "Rude stop at Zindabazar", "Demo complaint: the Sylhet bus skipped the Zindabazar stop.");
  await ensureSos("Demo Rajshahi SOS: passenger requested help at Shaheb Bazar", "RAJ-DEMO-51");
  await ensureAlert("Demo Rajshahi: route drift near RU", "RAJ-DEMO-52", AlertType.ROUTE_DEVIATION);
  await ensureComplaint("CMP-SEED-KHL-001", "KHL-DEMO-61", "Unsafe stop at Rupsha", "Demo complaint: the Khulna bus stopped outside the marked Rupsha point.");
  await ensureAlert("Demo Khulna: bus marked with an open deviation", "KHL-DEMO-62", AlertType.ROUTE_DEVIATION);
  await ensureSos("Demo Khulna SOS: help requested near Sonadanga", "KHL-DEMO-63");

  await prisma.systemSetting.createMany({
    data: [
      { key: "app.name", value: "Nirapad Transit", groupName: "general" },
      { key: "app.dataMode", value: "DEMO", groupName: "general" },
      { key: "app.timezone", value: "Asia/Dhaka", groupName: "general" },
      { key: "app.currency", value: "BDT", groupName: "general" },
      { key: "gps.sourceMode", value: "SIMULATION", groupName: "gps" },
      { key: "map.provider", value: "osm", groupName: "map" },
    ],
    skipDuplicates: true,
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "seed.completed",
      entity: "System",
      metadata: { note: "Demo dataset loaded. Not government records." },
    },
  });

  console.log("Seed complete.");
  console.log("Demo login password for all seeded accounts: Demo@12345");
  console.log("Accounts: admin@nirapad.gov.bd, government@nirapad.gov.bd, brta@nirapad.gov.bd,");
  console.log("Police places: police@nirapad.gov.bd (Dhaka), police.ctg@nirapad.gov.bd, police.sylhet@nirapad.gov.bd, police.rajshahi@nirapad.gov.bd, police.khulna@nirapad.gov.bd");
  console.log("owner.greenline@demo.bd, driver.rahim@demo.bd, passenger.fatima@demo.bd");
  const { ensureDemoCameras } = await import("../src/services/camera.service.js");
  await ensureDemoCameras();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
