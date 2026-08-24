import { io, Socket } from "socket.io-client";
import { SERVER_URL } from "./api";

let socket: Socket | null = null;

/** A single shared Socket.IO connection, created lazily and reused across the app. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      // Start the handshake over polling, then upgrade to WebSocket — starting
      // directly on WebSocket hangs indefinitely behind some host proxies
      // (observed on Render), since there's no polling session to upgrade from.
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}
