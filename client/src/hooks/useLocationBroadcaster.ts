import { useEffect, useRef } from "react";
import { getSocket } from "../services/socket";
import { distanceMeters } from "../services/geo";
import { LocationPoint } from "../types";

const MIN_DISTANCE_METERS = 5;
const MAX_INTERVAL_MS = 4000;
const MIN_INTERVAL_MS = 1000;

/**
 * Sends GPS updates to the server, but not on every single browser callback.
 * A point is sent once at least MIN_INTERVAL_MS has passed AND either the
 * device moved MIN_DISTANCE_METERS or MAX_INTERVAL_MS elapsed since the last
 * send — this keeps the marker responsive to real movement while avoiding a
 * flood of near-identical updates from GPS jitter while stationary.
 */
export function useLocationBroadcaster(
  trackingCode: string | null,
  position: GeolocationPosition | null,
  active: boolean
): void {
  const lastSentRef = useRef<{ point: LocationPoint; sentAt: number } | null>(null);

  useEffect(() => {
    if (!active || !trackingCode || !position) return;

    const point: LocationPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
      timestamp: position.timestamp,
    };

    const now = Date.now();
    const last = lastSentRef.current;
    const elapsed = last ? now - last.sentAt : Infinity;
    const moved = last ? distanceMeters(last.point, point) : Infinity;

    const shouldSend = elapsed >= MIN_INTERVAL_MS && (moved >= MIN_DISTANCE_METERS || elapsed >= MAX_INTERVAL_MS);
    if (!shouldSend) return;

    lastSentRef.current = { point, sentAt: now };
    getSocket().emit("delivery:location", { trackingCode, ...point });
  }, [trackingCode, position, active]);
}
