import { Order as OrderRow, LocationPoint as LocationPointRow } from "@prisma/client";
import { db } from "../db";
import { DeliveryStatus, LocationPoint, OrderStatus, OrderSummary, TrackingSession } from "../types";

const TRACKING_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
const MAX_HISTORY_POINTS = 500;

function randomTrackingCode(): string {
  return Array.from(
    { length: 6 },
    () => TRACKING_CODE_CHARS[Math.floor(Math.random() * TRACKING_CODE_CHARS.length)]
  ).join("");
}

async function generateUniqueTrackingCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomTrackingCode();
    const existing = await db.order.findUnique({ where: { trackingCode: code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique tracking code");
}

function formatOrderId(seq: number): string {
  return `ORD-${1000 + seq}`;
}

export function roomForOrder(orderId: string): string {
  return `order:${orderId}`;
}

function toLocationPoint(row: LocationPointRow): LocationPoint {
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy ?? undefined,
    timestamp: row.timestamp.getTime(),
  };
}

function toPublicSession(order: OrderRow, locations: LocationPointRow[]): TrackingSession {
  const points = locations.map(toLocationPoint);
  return {
    orderId: formatOrderId(order.seq),
    trackingCode: order.trackingCode,
    status: order.status as OrderStatus,
    deliveryStatus: order.deliveryStatus as DeliveryStatus,
    currentLocation: points[points.length - 1],
    locationHistory: points,
    createdAt: order.createdAt.getTime(),
  };
}

export async function createSession(): Promise<TrackingSession> {
  const trackingCode = await generateUniqueTrackingCode();
  const order = await db.order.create({ data: { trackingCode } });
  return toPublicSession(order, []);
}

/** Fetches an order with its recent location history, plus the raw DB row for internal use (e.g. binding a delivery socket to its internal id). */
export async function findOrderWithHistory(
  trackingCode: string
): Promise<{ order: OrderRow; session: TrackingSession } | undefined> {
  const order = await db.order.findUnique({ where: { trackingCode: trackingCode.toUpperCase() } });
  if (!order) return undefined;

  const locations = await db.locationPoint.findMany({
    where: { orderId: order.id },
    orderBy: { timestamp: "desc" },
    take: MAX_HISTORY_POINTS,
  });
  locations.reverse();

  return { order, session: toPublicSession(order, locations) };
}

export async function appendLocationPoint(orderRecordId: string, point: LocationPoint): Promise<void> {
  await db.locationPoint.create({
    data: {
      orderId: orderRecordId,
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy,
      timestamp: new Date(point.timestamp),
    },
  });
}

export async function updateDeliveryStatus(
  orderRecordId: string,
  deliveryStatus: DeliveryStatus
): Promise<void> {
  await db.order.update({ where: { id: orderRecordId }, data: { deliveryStatus } });
}

/** Permanently deletes an order and its location history (cascades via the DB relation). Returns false if it didn't exist. */
export async function deleteOrder(trackingCode: string): Promise<boolean> {
  try {
    await db.order.delete({ where: { trackingCode: trackingCode.toUpperCase() } });
    return true;
  } catch {
    return false;
  }
}

/** Lightweight order summaries for a browser's order-history list — no location history payload. */
export async function getOrderSummaries(trackingCodes: string[]): Promise<OrderSummary[]> {
  if (trackingCodes.length === 0) return [];

  const orders = await db.order.findMany({
    where: { trackingCode: { in: trackingCodes.map((c) => c.toUpperCase()) } },
    include: { locations: { orderBy: { timestamp: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => ({
    orderId: formatOrderId(order.seq),
    trackingCode: order.trackingCode,
    status: order.status as OrderStatus,
    deliveryStatus: order.deliveryStatus as DeliveryStatus,
    createdAt: order.createdAt.getTime(),
    currentLocation: order.locations[0] ? toLocationPoint(order.locations[0]) : undefined,
  }));
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
