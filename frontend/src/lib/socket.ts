"use client";

import { io, type Socket } from "socket.io-client";
import { getToken } from "./api";

const WS = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;
  socket = io(WS, {
    transports: ["websocket"],
    auth: { token: getToken() },
    autoConnect: true,
  });
  return socket;
}
