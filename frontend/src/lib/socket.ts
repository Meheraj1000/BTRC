"use client";

import { io, type Socket } from "socket.io-client";
import { getToken } from "./api";

const WS = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;
  const sameSite = typeof window !== "undefined" && WS === window.location.origin;
  socket = io(WS, {
    // The public site forwards live updates over HTTP. Vercel cannot upgrade that
    // connection to a websocket, so the browser stays on polling there.
    transports: sameSite ? ["polling"] : ["websocket"],
    upgrade: !sameSite,
    auth: { token: getToken() },
    autoConnect: true,
  });
  return socket;
}
