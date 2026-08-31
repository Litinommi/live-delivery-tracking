import { db } from "../db";
import { LocationPoint } from "../types";

const MIN_DESTINATION_METERS = 800;
const MAX_DESTINATION_METERS = 2500;

/**
 * There's no address/destination entry anywhere in this app by design (see
 * README) — "fake order" means there's nothing for a customer to type. But
 * distance-to-destination and ETA are meaningless without a destination to
 * measure against, so one is generated automatically: a random point 0.8–2.5km
 * from wherever the delivery partner's GPS first reports from, using the
 * standard "destination point given start + bearing + distance" spherical
 * formula (accurate at this scale, unlike a flat-earth approximation).
 */
function projectPoint(anchor: LocationPoint, bearingRad: number, distanceMeters: number) {
  const R = 6371000;
  const lat1 = (anchor.latitude * Math.PI) / 180;
  const lon1 = (anchor.longitude * Math.PI) / 180;
  const angularDistance = distanceMeters / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}

export function generateNearbyDestination(anchor: LocationPoint): { latitude: number; longitude: number } {
  const bearing = Math.random() * 2 * Math.PI;
  const distance = MIN_DESTINATION_METERS + Math.random() * (MAX_DESTINATION_METERS - MIN_DESTINATION_METERS);
  return projectPoint(anchor, bearing, distance);
}

/** Sets the order's destination the first time it's called for that order; a no-op after that. */
export async function ensureDestination(
  orderRecordId: string,
  anchor: LocationPoint
): Promise<{ latitude: number; longitude: number } | null> {
  const order = await db.order.findUnique({ where: { id: orderRecordId } });
  if (!order) return null;
  if (order.destinationLatitude != null && order.destinationLongitude != null) {
    return { latitude: order.destinationLatitude, longitude: order.destinationLongitude };
  }

  const destination = generateNearbyDestination(anchor);
  await db.order.update({
    where: { id: orderRecordId },
    data: { destinationLatitude: destination.latitude, destinationLongitude: destination.longitude },
  });
  return destination;
}
