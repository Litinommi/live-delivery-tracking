import { Server, Socket } from "socket.io";
import {
  appendLocation,
  canAcceptLocation,
  findSessionByDeliverySocket,
  getSession,
  roomForOrder,
  toPublicSession,
} from "../services/sessionStore";
import { DeliveryLocationPayload, JoinAck, JoinPayload, SessionRecord } from "../types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    isFiniteNumber(lat) && isFiniteNumber(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

function broadcastDeliveryStatus(io: Server, session: SessionRecord): void {
  io.to(roomForOrder(session.orderId)).emit("delivery:status", {
    deliveryStatus: session.deliveryStatus,
  });
}

export function registerSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    socket.on("customer:join", (payload: JoinPayload, ack?: (res: JoinAck) => void) => {
      const session = getSession(payload?.trackingCode ?? "");
      if (!session) {
        ack?.({ ok: false, error: "Invalid tracking code." });
        return;
      }
      socket.join(roomForOrder(session.orderId));
      socket.data.role = "customer";
      socket.data.trackingCode = session.trackingCode;
      session.customerSocketIds.add(socket.id);
      ack?.({ ok: true, session: toPublicSession(session) });
    });

    socket.on("delivery:join", (payload: JoinPayload, ack?: (res: JoinAck) => void) => {
      const session = getSession(payload?.trackingCode ?? "");
      if (!session) {
        ack?.({ ok: false, error: "Invalid tracking code." });
        return;
      }
      socket.join(roomForOrder(session.orderId));
      socket.data.role = "delivery";
      socket.data.trackingCode = session.trackingCode;
      session.deliverySocketId = socket.id;
      session.deliveryStatus = "CONNECTED";
      ack?.({ ok: true, session: toPublicSession(session) });
      broadcastDeliveryStatus(io, session);
    });

    socket.on("delivery:location", (payload: DeliveryLocationPayload) => {
      const session = getSession(payload?.trackingCode ?? "");
      if (!session) return;

      // Only the socket that joined as the delivery partner for this order may push locations.
      if (session.deliverySocketId !== socket.id) return;
      if (!isValidCoordinate(payload.latitude, payload.longitude)) return;

      const now = Date.now();
      if (!canAcceptLocation(session, now)) return;

      const point = {
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: isFiniteNumber(payload.accuracy) ? payload.accuracy : undefined,
        timestamp: isFiniteNumber(payload.timestamp) ? payload.timestamp : now,
      };
      appendLocation(session, point);

      if (session.deliveryStatus !== "TRACKING") {
        session.deliveryStatus = "TRACKING";
        broadcastDeliveryStatus(io, session);
      }

      io.to(roomForOrder(session.orderId)).emit("location:update", point);
    });

    socket.on("delivery:stop", (payload: JoinPayload) => {
      const session = getSession(payload?.trackingCode ?? "");
      if (!session || session.deliverySocketId !== socket.id) return;
      session.deliveryStatus = "CONNECTED";
      broadcastDeliveryStatus(io, session);
    });

    socket.on("disconnect", () => {
      const session = findSessionByDeliverySocket(socket.id);
      if (session) {
        session.deliverySocketId = undefined;
        session.deliveryStatus = "OFFLINE";
        broadcastDeliveryStatus(io, session);
      }
      const trackingCode = socket.data.trackingCode as string | undefined;
      if (trackingCode) {
        const s = getSession(trackingCode);
        s?.customerSocketIds.delete(socket.id);
      }
    });
  });
}
