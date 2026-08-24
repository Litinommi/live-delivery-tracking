const MIN_MS_BETWEEN_ACCEPTED_POINTS = 500;

/**
 * Ephemeral, process-local bindings for whichever socket is currently the
 * delivery partner for an order. Deliberately kept out of the database —
 * a socket id only means something to the single running server process
 * that holds the connection, so persisting it would be meaningless (and
 * wrong) the moment the process restarts.
 */
interface DeliveryBinding {
  socketId: string;
  orderRecordId: string; // internal DB id, avoids a query per GPS point
  displayOrderId: string; // "ORD-1001", used for the Socket.IO room name
  trackingStarted: boolean;
}

const bindingsByTrackingCode = new Map<string, DeliveryBinding>();
const lastAcceptedAtByTrackingCode = new Map<string, number>();

export function bindDeliverySocket(
  trackingCode: string,
  binding: Omit<DeliveryBinding, "trackingStarted">
): void {
  bindingsByTrackingCode.set(trackingCode, { ...binding, trackingStarted: false });
}

export function unbindDeliverySocket(trackingCode: string): void {
  bindingsByTrackingCode.delete(trackingCode);
  lastAcceptedAtByTrackingCode.delete(trackingCode);
}

export function getDeliveryBinding(trackingCode: string): DeliveryBinding | undefined {
  return bindingsByTrackingCode.get(trackingCode);
}

export function findTrackingCodeByDeliverySocket(socketId: string): string | undefined {
  for (const [trackingCode, binding] of bindingsByTrackingCode) {
    if (binding.socketId === socketId) return trackingCode;
  }
  return undefined;
}

/** Rejects points arriving unreasonably fast, regardless of client-side throttling. */
export function canAcceptLocation(trackingCode: string, now: number): boolean {
  const last = lastAcceptedAtByTrackingCode.get(trackingCode);
  return last === undefined || now - last >= MIN_MS_BETWEEN_ACCEPTED_POINTS;
}

export function markLocationAccepted(trackingCode: string, now: number): void {
  lastAcceptedAtByTrackingCode.set(trackingCode, now);
}
