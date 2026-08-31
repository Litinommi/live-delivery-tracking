import { GeoPoint, LocationPoint } from "../types";
import { distanceMeters } from "./geo";

const MIN_NOISE_FLOOR_METERS = 3;
const DEFAULT_ACCURACY_METERS = 12; // assumed when a fix reports no accuracy at all
const ACCURACY_FACTOR = 0.5;

/**
 * Faster than this between two consecutive fixes is essentially never real —
 * even fast highway driving is under 150 km/h, and this app tracks a phone,
 * not a plane. A jump like that is almost always a bad GPS fix (multipath,
 * a cold-start reading, or in testing, two mocked positions set close
 * together in wall-clock time) and should be discarded outright rather than
 * blended in — unlike ordinary noise, it isn't "no movement", it's bad data.
 */
const MAX_PLAUSIBLE_SPEED_KMH = 150;

export type SegmentClass = "noise" | "trusted" | "implausible";

export interface ClassifiedSegment {
  class: SegmentClass;
  meters: number;
  impliedKmh: number | null;
}

/**
 * How far two consecutive fixes must be apart to count as real movement rather
 * than GPS noise. A flat threshold can't win here: too low and stationary jitter
 * (phones commonly wander a few meters standing still) reads as movement; too
 * high and genuine slow movement — someone walking, GPS updating every ~4s —
 * gets silently zeroed out too, since a few km/h over a few seconds is only a
 * few meters. So this scales with the reported accuracy of the worse of the two
 * points: a fix accurate to 30m needs more clearance to be trusted than one
 * accurate to 5m, with a small floor for when accuracy is very good or missing.
 */
export function movementNoiseFloor(a: LocationPoint, b: LocationPoint): number {
  const accuracy = Math.max(a.accuracy ?? DEFAULT_ACCURACY_METERS, b.accuracy ?? DEFAULT_ACCURACY_METERS);
  return Math.max(MIN_NOISE_FLOOR_METERS, accuracy * ACCURACY_FACTOR);
}

/**
 * Single source of truth for "should this segment count as real movement" —
 * used by both distance-travelled and speed calculations so they never
 * disagree about which points to trust. Three outcomes: `noise` (too small to
 * be anything but jitter — treat as zero movement), `implausible` (too fast to
 * be physically real — discard entirely, don't even count it as "no
 * movement"), or `trusted` (counts fully).
 */
export function classifySegment(a: LocationPoint, b: LocationPoint): ClassifiedSegment {
  const meters = distanceMeters(a, b);
  const durationMs = b.timestamp - a.timestamp;
  if (durationMs <= 0) return { class: "noise", meters, impliedKmh: null };

  const impliedKmh = meters / 1000 / (durationMs / 3_600_000);
  if (impliedKmh > MAX_PLAUSIBLE_SPEED_KMH) return { class: "implausible", meters, impliedKmh };
  if (meters < movementNoiseFloor(a, b)) return { class: "noise", meters, impliedKmh };
  return { class: "trusted", meters, impliedKmh };
}

/**
 * Total distance actually travelled, by summing consecutive GPS segments —
 * NOT the straight line from the first point to the current one, which would
 * be wrong the moment the route isn't a straight line. Noise and implausible
 * segments are excluded so neither idle jitter nor a bad GPS jump inflates it.
 */
export function calculateDistanceTravelled(history: LocationPoint[]): number {
  let total = 0;
  for (let i = 1; i < history.length; i++) {
    const segment = classifySegment(history[i - 1], history[i]);
    if (segment.class === "trusted") total += segment.meters;
  }
  return total;
}

/** Straight-line distance remaining to the destination — the only distance an ETA can reasonably be based on without a road-routing service. */
export function calculateDistanceToDestination(current: GeoPoint, destination: GeoPoint): number {
  return distanceMeters(current, destination);
}
