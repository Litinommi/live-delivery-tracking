export type OrderStatus = "ON_THE_WAY" | "ARRIVED";

export type DeliveryStatus = "OFFLINE" | "CONNECTED" | "TRACKING";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

/** Full session state, as broadcast to clients. */
export interface TrackingSession {
  orderId: string;
  trackingCode: string;
  status: OrderStatus;
  deliveryStatus: DeliveryStatus;
  currentLocation?: LocationPoint;
  locationHistory: LocationPoint[];
  createdAt: number;
}

/** Lightweight order info for history lists — no location history payload. */
export interface OrderSummary {
  orderId: string;
  trackingCode: string;
  status: OrderStatus;
  deliveryStatus: DeliveryStatus;
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
