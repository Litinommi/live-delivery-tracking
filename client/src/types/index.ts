export type OrderStatus = "ON_THE_WAY" | "ARRIVED";

export type DeliveryStatus = "OFFLINE" | "CONNECTED" | "TRACKING";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface TrackingSession {
  orderId: string;
  trackingCode: string;
  status: OrderStatus;
  deliveryStatus: DeliveryStatus;
  currentLocation?: LocationPoint;
  locationHistory: LocationPoint[];
  createdAt: number;
}

export type SocketConnectionState = "connected" | "reconnecting" | "disconnected";
