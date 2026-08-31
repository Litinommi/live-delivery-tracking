/**
 * Where the order actually is in its lifecycle. Strictly forward-only and
 * one step at a time — see services/deliveryLifecycle.ts for the single
 * place that enforces that.
 */
export type DeliveryStage =
  | "ORDER_CREATED"
  | "PARTNER_CONNECTED"
  | "ORDER_PICKED_UP"
  | "ON_THE_WAY"
  | "NEAR_DESTINATION"
  | "DELIVERED";

/**
 * Whether the delivery partner's socket is actually here right now. Independent
 * of DeliveryStage — a partner can be OFFLINE mid-ON_THE_WAY (network blip) and
 * the order doesn't un-become ON_THE_WAY because of it.
 */
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

/** Full session state, as broadcast to clients. */
export interface TrackingSession {
  orderId: string;
  trackingCode: string;
  status: DeliveryStage;
  deliveryStatus: ConnectionStatus;
  currentLocation?: LocationPoint;
  locationHistory: LocationPoint[];
  /** Auto-generated once the partner's GPS starts flowing — see services/destination.ts. */
  destination?: GeoPoint;
  createdAt: number;
}

/** Lightweight order info for history lists — no location history payload. */
export interface OrderSummary {
  orderId: string;
  trackingCode: string;
  status: DeliveryStage;
  deliveryStatus: ConnectionStatus;
  createdAt: number;
  currentLocation?: LocationPoint;
}

export interface DeliveryLocationPayload {
  trackingCode: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface JoinPayload {
  trackingCode: string;
}

export interface JoinAck {
  ok: boolean;
  session?: TrackingSession;
  error?: string;
}

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
