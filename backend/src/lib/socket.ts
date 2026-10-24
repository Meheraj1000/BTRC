import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { isCorsOriginAllowed } from "../config/env.js";
import { logger } from "../config/logger.js";
import { prisma } from "./prisma.js";
import { verifyAccessToken } from "./jwt.js";
import { canJoinSocketRoom } from "../utils/socketRooms.js";
import { isPlaceScopedPolice } from "../utils/policeArea.js";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        callback(null, isCorsOriginAllowed(origin));
      },
      credentials: true,
    },
    pingInterval: 20000,
    pingTimeout: 15000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next();
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next();
    }
  });

  io.on("connection", (socket) => {
    const roles: string[] = socket.data.user?.roles ?? [];
    const policeScoped = isPlaceScopedPolice(roles);
    if (!policeScoped) socket.join("public:buses");
    if (socket.data.user?.sub) {
      for (const role of roles) socket.join(`role:${role}`);
      socket.join(`user:${socket.data.user.sub}`);
      if (policeScoped) {
        prisma.policeArea.findMany({
          where: { userId: socket.data.user.sub },
          select: { city: true },
        }).then((rows) => {
          const places = rows.map((row) => row.city);
          socket.data.user = { ...socket.data.user, places };
          for (const city of places) socket.join(`place:${city}`);
        }).catch(() => undefined);
      }
      if (roles.includes("TRANSPORT_OWNER")) {
        prisma.transportCompany.findFirst({
          where: { ownerUserId: socket.data.user.sub, deletedAt: null },
          select: { id: true },
        }).then((company) => {
          if (!company) return;
          socket.data.user = { ...socket.data.user, companyId: company.id };
          socket.join(`company:${company.id}`);
        }).catch(() => undefined);
      }
    }
    logger.info("ws_connected", { id: socket.id, authenticated: Boolean(socket.data.user?.sub) });
    socket.on("subscribe", (room: unknown) => {
      if (typeof room !== "string") return;
      if (canJoinSocketRoom(room, socket.data.user)) {
        socket.join(room);
        return;
      }
      logger.info("ws_subscribe_denied", { id: socket.id, room });
    });
    socket.on("disconnect", () => logger.info("ws_disconnected", { id: socket.id }));
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function broadcastBusLocation(publicDto: unknown, operationalDto?: { companyId?: string | null; city?: string | null }) {
  io?.to("public:buses").emit("bus:location", publicDto);
  if (operationalDto) {
    io?.to("role:SUPER_ADMIN").emit("bus:location:ops", operationalDto);
    io?.to("role:GOVERNMENT").emit("bus:location:ops", operationalDto);
    io?.to("role:BRTA").emit("bus:location:ops", operationalDto);
    if (operationalDto.companyId) {
      io?.to(`company:${operationalDto.companyId}`).emit("bus:location:ops", operationalDto);
    }
    if (operationalDto.city) io?.to(`place:${operationalDto.city}`).emit("bus:location:ops", operationalDto);
  }
}

export function broadcastRouteStatus(payload: { companyId?: string | null; city?: string | null; [key: string]: unknown }) {
  io?.to("role:SUPER_ADMIN").emit("route:status", payload);
  io?.to("role:GOVERNMENT").emit("route:status", payload);
  io?.to("role:BRTA").emit("route:status", payload);
  if (payload.companyId) {
    io?.to(`company:${payload.companyId}`).emit("route:status", payload);
  }
  if (payload.city) io?.to(`place:${payload.city}`).emit("route:status", payload);
}

export function broadcastAlert(payload: unknown, companyId?: string | null, city?: string | null) {
  io?.to("role:SUPER_ADMIN").emit("alert:new", payload);
  io?.to("role:GOVERNMENT").emit("alert:new", payload);
  io?.to("role:BRTA").emit("alert:new", payload);
  if (companyId) io?.to(`company:${companyId}`).emit("alert:new", payload);
  if (city) io?.to(`place:${city}`).emit("alert:new", payload);
}

export function broadcastComplaint(payload: unknown, companyId?: string | null, city?: string | null) {
  io?.to("role:SUPER_ADMIN").emit("complaint:new", payload);
  io?.to("role:GOVERNMENT").emit("complaint:new", payload);
  io?.to("role:BRTA").emit("complaint:new", payload);
  io?.to("role:TRANSPORT_OWNER").emit("complaint:new", payload);
  if (companyId) io?.to(`company:${companyId}`).emit("complaint:new", payload);
  if (city) io?.to(`place:${city}`).emit("complaint:new", payload);
}

export function broadcastLostFound(payload: unknown, companyId?: string | null, city?: string | null) {
  io?.to("role:SUPER_ADMIN").emit("lostfound:new", payload);
  io?.to("role:GOVERNMENT").emit("lostfound:new", payload);
  io?.to("role:BRTA").emit("lostfound:new", payload);
  io?.to("role:TRANSPORT_OWNER").emit("lostfound:new", payload);
  if (companyId) io?.to(`company:${companyId}`).emit("lostfound:new", payload);
  if (city) io?.to(`place:${city}`).emit("lostfound:new", payload);
}

export function broadcastSos(payload: unknown, city?: string | null) {
  io?.to("role:SUPER_ADMIN").emit("sos:new", payload);
  io?.to("role:GOVERNMENT").emit("sos:new", payload);
  if (city) io?.to(`place:${city}`).emit("sos:new", payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
