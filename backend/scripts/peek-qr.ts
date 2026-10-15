import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.bus.findFirst({
    where: { registrationNo: "DHAKA-METRO-D-DEMO-11" },
    select: { registrationNo: true, qrToken: true },
  });
  console.log(JSON.stringify(r, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
