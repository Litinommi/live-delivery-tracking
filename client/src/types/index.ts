/**
 * Where the order actually is in its lifecycle. Strictly forward-only and one
 * step at a time — the server (services/deliveryLifecycle.ts) is the single
 * source of truth for what's valid; the client-side copy in
 * services/deliveryLifecycle.ts exists only to decide which action button to
 * show, never to accept a transition on its own authority.
 */
export type DeliveryStage =
  | "ORDER_CREATED"
  | "PARTNER_CONNECTED"
  | "ORDER_PICKED_UP"
  | "ON_THE_WAY"
  | "NEAR_DESTINATION"
  | "DELIVERED";

/** Whether the delivery partner's socket is actually here right now — independent of DeliveryStage. */
export type ConnectionStatus = "OFFLINE" | "CONNECTED" | "TRACKING" | "RECONNECTING";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface TrackingSession {
  orderId: string;
  trackingCode: string;
  status: DeliveryStage;
  deliveryStatus: ConnectionStatus;
  currentLocation?: LocationPoint;
  locationHistory: LocationPoint[];
  /** Auto-generated server-side once the partner's GPS starts flowing. */
  destination?: GeoPoint;
  createdAt: number;
}

/** Lightweight order info for the history list — no location history payload. */
export interface OrderSummary {
  orderId: string;
  trackingCode: string;
  status: DeliveryStage;
  deliveryStatus: ConnectionStatus;
  createdAt: number;
  currentLocation?: LocationPoint;
}

export type SocketConnectionState = "connected" | "reconnecting" | "disconnected";

export interface AdvanceStagePayload {
  trackingCode: string;
  targetStage: DeliveryStage;
}

export interface AdvanceStageAck {
  ok: boolean;
  stage?: DeliveryStage;
  error?: string;
}

export interface DestinationUpdatePayload {
  destination: GeoPoint;
}
