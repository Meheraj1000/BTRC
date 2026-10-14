import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.bus.findMany({
    where: { registrationNo: { contains: "DEMO" } },
    select: { registrationNo: true, qrToken: true },
    orderBy: { registrationNo: "asc" },
  });
  for (const row of rows) {
    console.log(`${row.registrationNo}\t${row.qrToken ?? "MISSING"}`);
  }
  console.log(`total=${rows.length} missing=${rows.filter((r) => !r.qrToken).length}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
