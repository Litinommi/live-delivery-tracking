import { Server, Socket } from "socket.io";
import {
  bindDeliverySocket,
  canAcceptLocation,
  findTrackingCodeByDeliverySocket,
  getDeliveryBinding,
  markLocationAccepted,
  unbindDeliverySocket,
} from "../services/liveState";
import {
  appendLocationPoint,
  findOrderWithHistory,
  roomForOrder,
  updateDeliveryStatus,
} from "../services/sessionStore";
import { DeliveryLocationPayload, DeliveryStatus, JoinAck, JoinPayload, LocationPoint } from "../types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    isFiniteNumber(lat) && isFiniteNumber(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

function broadcastDeliveryStatus(io: Server, displayOrderId: string, deliveryStatus: DeliveryStatus): void {
  io.to(roomForOrder(displayOrderId)).emit("delivery:status", { deliveryStatus });
}

export function registerSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    socket.on("customer:join", async (payload: JoinPayload, ack?: (res: JoinAck) => void) => {
      try {
        const found = await findOrderWithHistory(payload?.trackingCode ?? "");
        if (!found) {
          ack?.({ ok: false, error: "Invalid tracking code." });
          return;
        }
        // A customer can switch which order they're viewing (order history) without
        // reconnecting — make sure they only ever receive events for one order at a time.
        const room = roomForOrder(found.session.orderId);
        const previousRoom = socket.data.customerRoom as string | undefined;
        if (previousRoom && previousRoom !== room) socket.leave(previousRoom);
        socket.join(room);
        socket.data.customerRoom = room;
        ack?.({ ok: true, session: found.session });
      } catch (err) {
        console.error("customer:join failed:", err);
        ack?.({ ok: false, error: "Something went wrong. Please try again." });
      }
    });

    socket.on("delivery:join", async (payload: JoinPayload, ack?: (res: JoinAck) => void) => {
      try {
        const found = await findOrderWithHistory(payload?.trackingCode ?? "");
        if (!found) {
          ack?.({ ok: false, error: "Invalid tracking code." });
          return;
        }
        const room = roomForOrder(found.session.orderId);
        const previousRoom = socket.data.deliveryRoom as string | undefined;
        if (previousRoom && previousRoom !== room) socket.leave(previousRoom);
        socket.join(room);
        socket.data.deliveryRoom = room;
        bindDeliverySocket(found.session.trackingCode, {
          socketId: socket.id,
          orderRecordId: found.order.id,
          displayOrderId: found.session.orderId,
        });
        await updateDeliveryStatus(found.order.id, "CONNECTED");
        ack?.({ ok: true, session: { ...found.session, deliveryStatus: "CONNECTED" } });
        broadcastDeliveryStatus(io, found.session.orderId, "CONNECTED");
      } catch (err) {
        console.error("delivery:join failed:", err);
        ack?.({ ok: false, error: "Something went wrong. Please try again." });
      }
    });

    socket.on("delivery:location", async (payload: DeliveryLocationPayload) => {
      try {
        const trackingCode = (payload?.trackingCode ?? "").toUpperCase();
        const binding = getDeliveryBinding(trackingCode);
        // Only the socket that joined as this order's delivery partner may push locations.
        if (!binding || binding.socketId !== socket.id) return;
        if (!isValidCoordinate(payload.latitude, payload.longitude)) return;

        const now = Date.now();
        if (!canAcceptLocation(trackingCode, now)) return;
        markLocationAccepted(trackingCode, now);

        const point: LocationPoint = {
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracy: isFiniteNumber(payload.accuracy) ? payload.accuracy : undefined,
          timestamp: isFiniteNumber(payload.timestamp) ? payload.timestamp : now,
        };

        await appendLocationPoint(binding.orderRecordId, point);
        io.to(roomForOrder(binding.displayOrderId)).emit("location:update", point);

        if (!binding.trackingStarted) {
          binding.trackingStarted = true;
          await updateDeliveryStatus(binding.orderRecordId, "TRACKING");
          broadcastDeliveryStatus(io, binding.displayOrderId, "TRACKING");
        }
      } catch (err) {
        console.error("delivery:location failed:", err);
      }
    });

    socket.on("delivery:stop", async (payload: JoinPayload) => {
      try {
        const trackingCode = (payload?.trackingCode ?? "").toUpperCase();
        const binding = getDeliveryBinding(trackingCode);
        if (!binding || binding.socketId !== socket.id) return;
        binding.trackingStarted = false;
        await updateDeliveryStatus(binding.orderRecordId, "CONNECTED");
        broadcastDeliveryStatus(io, binding.displayOrderId, "CONNECTED");
      } catch (err) {
        console.error("delivery:stop failed:", err);
      }
    });

    socket.on("disconnect", async () => {
      try {
        const trackingCode = findTrackingCodeByDeliverySocket(socket.id);
        if (!trackingCode) return;
        const binding = getDeliveryBinding(trackingCode);
        unbindDeliverySocket(trackingCode);
        if (binding) {
          await updateDeliveryStatus(binding.orderRecordId, "OFFLINE");
          broadcastDeliveryStatus(io, binding.displayOrderId, "OFFLINE");
        }
      } catch (err) {
        console.error("disconnect handling failed:", err);
      }
    });
  });
}
