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

/** Internal server-side record — adds socket bookkeeping not sent to clients. */
export interface SessionRecord extends TrackingSession {
  deliverySocketId?: string;
  customerSocketIds: Set<string>;
  lastLocationAcceptedAt?: number;
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
