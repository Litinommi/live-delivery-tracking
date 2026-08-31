/** Inside this radius, "how many minutes away" stops being a meaningful question. */
const ARRIVING_THRESHOLD_METERS = 150;

/** Below this, dividing distance by speed produces wild, meaningless ETAs (hours for a few hundred meters). */
const MIN_SPEED_FOR_ETA_KMH = 1.5;

export type EtaResult =
  | { kind: "arriving" }
  | { kind: "unavailable" }
  | { kind: "estimate"; seconds: number };

/**
 * ETA = remaining distance ÷ smoothed speed — nothing hardcoded. Both inputs
 * are already noise-filtered (see distance.ts / speed.ts), which is what
 * keeps this from jumping around on GPS jitter; this function just adds the
 * two extra guards a raw division can't handle on its own: an "arrived"
 * radius (dividing a tiny remaining distance by a normal speed still gives a
 * nonzero number of seconds) and a minimum speed (dividing by ~0 gives a
 * wildly large, useless number of hours).
 */
export function calculateETA(remainingMeters: number, smoothedSpeedKmh: number | null): EtaResult {
  if (remainingMeters <= ARRIVING_THRESHOLD_METERS) return { kind: "arriving" };
  if (smoothedSpeedKmh === null || smoothedSpeedKmh < MIN_SPEED_FOR_ETA_KMH) return { kind: "unavailable" };

  const hours = remainingMeters / 1000 / smoothedSpeedKmh;
  return { kind: "estimate", seconds: hours * 3600 };
}
