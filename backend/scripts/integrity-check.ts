import { prisma } from "../src/lib/prisma.js";

async function q(label: string, fn: () => Promise<unknown>) {
  const value = await fn();
  console.log(`${label}: ${JSON.stringify(value)}`);
}

async function main() {
  await q("users", () => prisma.user.count());
  await q("roles", () => prisma.role.count());
  await q("permissions", () => prisma.permission.count());
  await q("rolePermissions", () => prisma.rolePermission.count());
  await q("buses", () => prisma.bus.count());
  await q("drivers", () => prisma.driver.count());
  await q("routes", () => prisma.route.count());
  await q("trips", () => prisma.trip.count());
  await q("gpsHistory", () => prisma.gpsLocation.count());
  await q("gpsLatest", () => prisma.gpsLatestLocation.count());
  await q("sos", () => prisma.sosRequest.count());
  await q("alerts", () => prisma.alert.count());
  await q("complaints", () => prisma.complaint.count());
  await q("notifications", () => prisma.notification.count());
  await q("audit", () => prisma.auditLog.count());
  await q("accidents", () => prisma.accident.count());
  await q("analyticsSnapshots", () => prisma.analyticsSnapshot.count());

  await q("dupEmails", () => prisma.$queryRaw`SELECT email, count(*)::int AS c FROM users GROUP BY email HAVING count(*) > 1`);
  await q("dupRegs", () => prisma.$queryRaw`SELECT "registrationNo", count(*)::int AS c FROM buses GROUP BY "registrationNo" HAVING count(*) > 1`);
  await q("dupLicenses", () => prisma.$queryRaw`SELECT "licenseNumber", count(*)::int AS c FROM drivers GROUP BY "licenseNumber" HAVING count(*) > 1`);
  await q("dupRouteCodes", () => prisma.$queryRaw`SELECT code, count(*)::int AS c FROM routes GROUP BY code HAVING count(*) > 1`);
  await q("dupPerms", () => prisma.$queryRaw`SELECT code, count(*)::int AS c FROM permissions GROUP BY code HAVING count(*) > 1`);

  await q("orphanGpsBus", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM gps_locations g LEFT JOIN buses b ON g."busId"=b.id WHERE b.id IS NULL`);
  await q("orphanGpsTrip", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM gps_locations g LEFT JOIN trips t ON g."tripId"=t.id WHERE g."tripId" IS NOT NULL AND t.id IS NULL`);
  await q("orphanGpsDriver", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM gps_locations g LEFT JOIN drivers d ON g."driverId"=d.id WHERE g."driverId" IS NOT NULL AND d.id IS NULL`);
  await q("orphanGpsRoute", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM gps_locations g LEFT JOIN routes r ON g."routeId"=r.id WHERE g."routeId" IS NOT NULL AND r.id IS NULL`);
  await q("orphanLatestBus", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM gps_latest_locations g LEFT JOIN buses b ON g."busId"=b.id WHERE b.id IS NULL`);
  await q("orphanSosBus", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM sos_requests s LEFT JOIN buses b ON s."busId"=b.id WHERE s."busId" IS NOT NULL AND b.id IS NULL`);
  await q("orphanSosTrip", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM sos_requests s LEFT JOIN trips t ON s."tripId"=t.id WHERE s."tripId" IS NOT NULL AND t.id IS NULL`);
  await q("orphanComplaintDriver", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM complaints c LEFT JOIN drivers d ON c."driverId"=d.id WHERE c."driverId" IS NOT NULL AND d.id IS NULL`);
  await q("orphanAlertRoute", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM alerts a LEFT JOIN routes r ON a."routeId"=r.id WHERE a."routeId" IS NOT NULL AND r.id IS NULL`);
  await q("orphanAssignRoute", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM bus_assignments a LEFT JOIN routes r ON a."routeId"=r.id WHERE r.id IS NULL`);
  await q("orphanDrvAssignBus", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM driver_assignments a LEFT JOIN buses b ON a."busId"=b.id WHERE b.id IS NULL`);
  await q("orphanComplaintBus", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM complaints c LEFT JOIN buses b ON c."busId"=b.id WHERE c."busId" IS NOT NULL AND b.id IS NULL`);

  await q("badLatGps", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM gps_locations WHERE latitude < -90 OR latitude > 90 OR longitude < -180 OR longitude > 180`);
  await q("badLatLatest", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM gps_latest_locations WHERE latitude < -90 OR latitude > 90 OR longitude < -180 OR longitude > 180`);
  await q("overlapBusTrips", () => prisma.$queryRaw`SELECT "busId", count(*)::int AS c FROM trips WHERE status='IN_PROGRESS' GROUP BY "busId" HAVING count(*) > 1`);
  await q("overlapDriverTrips", () => prisma.$queryRaw`SELECT "driverId", count(*)::int AS c FROM trips WHERE status='IN_PROGRESS' GROUP BY "driverId" HAVING count(*) > 1`);
  await q("usersWithoutRoles", () => prisma.$queryRaw`SELECT count(*)::int AS c FROM users u LEFT JOIN user_roles ur ON u.id=ur."userId" WHERE ur."userId" IS NULL AND u."deletedAt" IS NULL`);
  await q("roleCodes", () => prisma.$queryRaw`SELECT code::text FROM roles ORDER BY code`);
  await q("softDeletedUsers", () => prisma.user.count({ where: { deletedAt: { not: null } } }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
