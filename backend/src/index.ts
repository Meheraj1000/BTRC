import { createServer } from "node:http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createApp } from "./app.js";
import { initSocket } from "./lib/socket.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const server = createServer(app);
initSocket(server);

async function main() {
  await prisma.$connect();
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logger.error("port_in_use", {
        port: env.BACKEND_PORT,
        hint: "The API is already running. Open http://localhost:4000/health — do not start a second copy.",
      });
      process.exit(0);
    }
    throw err;
  });
  server.listen(env.BACKEND_PORT, () => {
    logger.info("server_started", {
      port: env.BACKEND_PORT,
      gpsMode: env.GPS_SOURCE_MODE,
      timezone: "Asia/Dhaka",
    });
  });
}

main().catch((err) => {
  logger.error("server_failed", { err });
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
