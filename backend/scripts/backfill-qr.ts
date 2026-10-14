import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const buses = await prisma.bus.findMany({
    where: { OR: [{ qrToken: null }, { qrToken: "" }] },
    select: { id: true, registrationNo: true },
  });
  for (const bus of buses) {
    await prisma.bus.update({
      where: { id: bus.id },
      data: { qrToken: randomBytes(12).toString("hex") },
    });
    console.log("QR assigned:", bus.registrationNo);
  }
  console.log(`Backfilled ${buses.length} buses`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
