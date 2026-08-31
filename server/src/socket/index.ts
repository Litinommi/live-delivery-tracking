import { Server, Socket } from "socket.io";
import {
  bindDeliverySocket,
  cancelOfflineTimeout,
  canAcceptLocation,
  findTrackingCodeByDeliverySocket,
  getDeliveryBinding,
  markLocationAccepted,
  scheduleOfflineTimeout,
  unbindDeliverySocket,
} from "../services/liveState";
import {
  advanceDeliveryStage,
  appendLocationPoint,
  findOrderWithHistory,
  roomForOrder,
  updateDeliveryStatus,
} from "../services/sessionStore";
import {
  AdvanceStageAck,
  AdvanceStagePayload,
  ConnectionStatus,
  DeliveryLocationPayload,
  DeliveryStage,
  JoinAck,
  JoinPayload,
  LocationPoint,
} from "../types";

/** Grace window after a delivery socket drops before the order is actually marked OFFLINE. */
const RECONNECT_GRACE_MS = 12000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    isFiniteNumber(lat) && isFiniteNumber(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

function broadcastDeliveryStatus(io: Server, displayOrderId: string, deliveryStatus: ConnectionStatus): void {
  io.to(roomForOrder(displayOrderId)).emit("delivery:status", { deliveryStatus });
}

function broadcastLifecycle(io: Server, displayOrderId: string, stage: DeliveryStage): void {
  io.to(roomForOrder(displayOrderId)).emit("lifecycle:update", { stage });
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

        // This may be a genuine first connect, or a reconnect within the grace
        // window a previous disconnect opened — either way, that pending "go
        // offline" no longer applies once someone has actually rejoined.
        cancelOfflineTimeout(found.session.trackingCode);

        bindDeliverySocket(found.session.trackingCode, {
          socketId: socket.id,
          orderRecordId: found.order.id,
          displayOrderId: found.session.orderId,
        });
        await updateDeliveryStatus(found.order.id, "CONNECTED");
        broadcastDeliveryStatus(io, found.session.orderId, "CONNECTED");

        // First-ever connect advances the lifecycle; a reconnect later in the
        // order's life is not a valid ORDER_CREATED->PARTNER_CONNECTED move from
        // wherever it currently is, so this is a harmless no-op in that case.
        let stage = found.session.status;
        const advanced = await advanceDeliveryStage(found.order.id, "PARTNER_CONNECTED");
        if (advanced.ok) {
          stage = advanced.stage;
          broadcastLifecycle(io, found.session.orderId, stage);
        }

        ack?.({ ok: true, session: { ...found.session, status: stage, deliveryStatus: "CONNECTED" } });
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

        // "When the partner enters tracking mode, the order should progress
        // appropriately" — only actually moves the needle if the order is
        // sitting at ORDER_PICKED_UP; a no-op otherwise. Deliberately NOT
        // gated behind the trackingStarted flag above: GPS starts flowing as
        // soon as the phone connects, well before "Mark Picked Up" is tapped,
        // so the point that's actually sitting at ORDER_PICKED_UP is rarely
        // the first one this binding ever sent — every accepted point gets a
        // (cheap, almost-always-rejected) attempt so the real one isn't missed.
        const advanced = await advanceDeliveryStage(binding.orderRecordId, "ON_THE_WAY");
        if (advanced.ok) broadcastLifecycle(io, binding.displayOrderId, advanced.stage);
      } catch (err) {
        console.error("delivery:location failed:", err);
      }
    });

    /** Explicit lifecycle actions from the mobile app (Mark Picked Up / Near Destination / Delivered). */
    socket.on("delivery:advanceStage", async (payload: AdvanceStagePayload, ack?: (res: AdvanceStageAck) => void) => {
      try {
        const trackingCode = (payload?.trackingCode ?? "").toUpperCase();
        const binding = getDeliveryBinding(trackingCode);
        if (!binding || binding.socketId !== socket.id) {
          ack?.({ ok: false, error: "Not authorized for this order." });
          return;
        }
        if (!payload?.targetStage) {
          ack?.({ ok: false, error: "Missing target stage." });
          return;
        }

        const result = await advanceDeliveryStage(binding.orderRecordId, payload.targetStage);
        if (!result.ok) {
          ack?.({ ok: false, error: result.error });
          return;
        }

        broadcastLifecycle(io, binding.displayOrderId, result.stage);
        ack?.({ ok: true, stage: result.stage });

        // Delivered means there's nothing left to track — stop broadcasting further
        // locations under this binding and drop back to a plain "connected" state.
        if (result.stage === "DELIVERED") {
          binding.trackingStarted = false;
          await updateDeliveryStatus(binding.orderRecordId, "CONNECTED");
          broadcastDeliveryStatus(io, binding.displayOrderId, "CONNECTED");
        }
      } catch (err) {
        console.error("delivery:advanceStage failed:", err);
        ack?.({ ok: false, error: "Something went wrong. Please try again." });
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
        if (!binding) return;

        // Don't jump straight to OFFLINE — a dropped socket is often just a network
        // blip that's already being retried. Show RECONNECTING immediately, and only
        // commit to OFFLINE if nobody has rejoined by the time the grace window ends.
        await updateDeliveryStatus(binding.orderRecordId, "RECONNECTING");
        broadcastDeliveryStatus(io, binding.displayOrderId, "RECONNECTING");

        scheduleOfflineTimeout(trackingCode, RECONNECT_GRACE_MS, () => {
          updateDeliveryStatus(binding.orderRecordId, "OFFLINE")
            .then(() => broadcastDeliveryStatus(io, binding.displayOrderId, "OFFLINE"))
            .catch((err) => console.error("offline-timeout update failed:", err));
        });
      } catch (err) {
        console.error("disconnect handling failed:", err);
      }
    });
  });
}
