import { PrismaClient, RoleCode } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("Demo@12345", 10);
  const role = await prisma.role.findUnique({ where: { code: RoleCode.PASSENGER } });
  if (!role) throw new Error("PASSENGER role missing — run full seed first");

  const user = await prisma.user.upsert({
    where: { email: "qr.emergency@nirapad.gov.bd" },
    update: { fullName: "QR Emergency Reporter (System)", status: "ACTIVE", passwordHash: hash },
    create: {
      email: "qr.emergency@nirapad.gov.bd",
      passwordHash: hash,
      fullName: "QR Emergency Reporter (System)",
      phone: null,
      status: "ACTIVE",
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  await prisma.passenger.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, emergencyName: "System", emergencyContact: "N/A" },
  });

  console.log("QR emergency reporter ready:", user.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
