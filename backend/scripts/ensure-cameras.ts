import { prisma } from "../src/lib/prisma.js";
import { ensureDemoCameras } from "../src/services/camera.service.js";

ensureDemoCameras()
  .then(async () => {
    const total = await prisma.streetCamera.count();
    console.log(`Demo street cameras ready: ${total}`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
