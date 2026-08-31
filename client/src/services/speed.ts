import { LocationPoint } from "../types";
import { classifySegment } from "./distance";

/** How heavily each new segment reading pulls the smoothed speed — lower = smoother but slower to react to real changes. */
const SMOOTHING_ALPHA = 0.35;

export interface SpeedMetrics {
  /** Recent, EMA-smoothed speed in km/h. `null` only when there isn't enough data to say anything at all. */
  current: number | null;
  /** Distance travelled ÷ total elapsed time, in km/h. `null` under the same condition as `current`. */
  average: number | null;
}

/**
 * Speed from consecutive GPS points, smoothed so a single noisy fix can't
 * produce an "extreme value" spike. Each segment is classified the same way
 * distance-travelled classifies it (see distance.ts): a `noise` segment
 * contributes a sample of 0 (a genuinely stationary partner should read as
 * ~0 km/h, not freeze at the last real reading), an `implausible` segment —
 * a physically impossible jump, almost certainly a bad fix — is skipped
 * entirely rather than blended in, and a `trusted` segment contributes its
 * real speed.
 */
export function calculateSpeedMetrics(history: LocationPoint[]): SpeedMetrics {
  if (history.length < 2) return { current: null, average: null };

  let smoothed: number | null = null;
  let travelledMeters = 0;

  for (let i = 1; i < history.length; i++) {
    const segment = classifySegment(history[i - 1], history[i]);
    if (segment.class === "implausible") continue;

    if (segment.class === "trusted") travelledMeters += segment.meters;
    const sample = segment.class === "trusted" ? (segment.impliedKmh as number) : 0;
    smoothed = smoothed === null ? sample : SMOOTHING_ALPHA * sample + (1 - SMOOTHING_ALPHA) * smoothed;
  }

  const totalDurationHrs = (history[history.length - 1].timestamp - history[0].timestamp) / 3_600_000;
  const average = totalDurationHrs > 0 ? travelledMeters / 1000 / totalDurationHrs : null;

  return { current: smoothed, average };
}
