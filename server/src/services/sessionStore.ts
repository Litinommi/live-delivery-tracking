import { LocationPoint, SessionRecord, TrackingSession } from "../types";

const TRACKING_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
const MAX_HISTORY_POINTS = 500;
const MIN_MS_BETWEEN_ACCEPTED_POINTS = 500; // server-side floor, defends against a runaway client

/** Order numbers are sequential and start at 1001, purely for a friendly display id. */
let orderSequence = 1000;

const sessionsByTrackingCode = new Map<string, SessionRecord>();

function generateTrackingCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: 6 },
      () => TRACKING_CODE_CHARS[Math.floor(Math.random() * TRACKING_CODE_CHARS.length)]
    ).join("");
  } while (sessionsByTrackingCode.has(code));
  return code;
}

export function createSession(): SessionRecord {
  orderSequence += 1;
  const record: SessionRecord = {
    orderId: `ORD-${orderSequence}`,
    trackingCode: generateTrackingCode(),
    status: "ON_THE_WAY",
    deliveryStatus: "OFFLINE",
    locationHistory: [],
    createdAt: Date.now(),
    customerSocketIds: new Set(),
  };
  sessionsByTrackingCode.set(record.trackingCode, record);
  return record;
}

export function getSession(trackingCode: string): SessionRecord | undefined {
  return sessionsByTrackingCode.get(trackingCode.toUpperCase());
}

export function roomForOrder(orderId: string): string {
  return `order:${orderId}`;
}

/** Distance between two GPS points in meters (Haversine formula). */
export function distanceMeters(a: LocationPoint, b: LocationPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rejects points arriving unreasonably fast, regardless of client-side throttling. */
export function canAcceptLocation(session: SessionRecord, now: number): boolean {
  if (session.lastLocationAcceptedAt === undefined) return true;
  return now - session.lastLocationAcceptedAt >= MIN_MS_BETWEEN_ACCEPTED_POINTS;
}

export function appendLocation(session: SessionRecord, point: LocationPoint): void {
  session.currentLocation = point;
  session.lastLocationAcceptedAt = Date.now();
  session.locationHistory.push(point);
  if (session.locationHistory.length > MAX_HISTORY_POINTS) {
    session.locationHistory.splice(0, session.locationHistory.length - MAX_HISTORY_POINTS);
  }
}

export function toPublicSession(session: SessionRecord): TrackingSession {
  const { orderId, trackingCode, status, deliveryStatus, currentLocation, locationHistory, createdAt } =
    session;
  return { orderId, trackingCode, status, deliveryStatus, currentLocation, locationHistory, createdAt };
}

/** Find the session currently owned by a given delivery socket, e.g. on disconnect. */
export function findSessionByDeliverySocket(socketId: string): SessionRecord | undefined {
  for (const session of sessionsByTrackingCode.values()) {
    if (session.deliverySocketId === socketId) return session;
  }
  return undefined;
}
