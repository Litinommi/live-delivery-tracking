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

/**
 * A dropped delivery socket doesn't necessarily mean the partner is really
 * gone — it might just be a network blip that socket.io-client is already
 * retrying. Give it a short grace window (see RECONNECT_GRACE_MS in
 * socket/index.ts) before actually declaring the order OFFLINE, so a quick
 * reconnect can cancel the pending flip instead of visibly bouncing the
 * customer's UI to Offline and back.
 */
const offlineTimeoutsByTrackingCode = new Map<string, NodeJS.Timeout>();

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

/** Cancels any previously scheduled offline-flip for this order before scheduling a new one. */
export function scheduleOfflineTimeout(trackingCode: string, delayMs: number, run: () => void): void {
  cancelOfflineTimeout(trackingCode);
  const handle = setTimeout(() => {
    offlineTimeoutsByTrackingCode.delete(trackingCode);
    run();
  }, delayMs);
  offlineTimeoutsByTrackingCode.set(trackingCode, handle);
}

export function cancelOfflineTimeout(trackingCode: string): void {
  const existing = offlineTimeoutsByTrackingCode.get(trackingCode);
  if (existing) {
    clearTimeout(existing);
    offlineTimeoutsByTrackingCode.delete(trackingCode);
  }
}
