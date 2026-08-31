import { useMemo } from "react";
import { Truck } from "lucide-react";
import { TrackingSession } from "../types";
import { STAGE_LABELS } from "../services/deliveryLifecycle";
import { calculateDistanceToDestination, calculateDistanceTravelled } from "../services/distance";
import { calculateSpeedMetrics } from "../services/speed";
import { calculateETA } from "../services/eta";
import { formatDistance, formatETA, formatSpeed } from "../services/trackingFormat";
import { formatRelativeTime } from "../services/geo";
import { Field } from "./OrderCard";

interface TrackingMetricsPanelProps {
  session: TrackingSession;
  now: number;
}

/**
 * The compact "at a glance" metrics block — distance/speed/ETA. Deliberately
 * separate from DeliveryStageTimeline: that's the lifecycle checklist, this is
 * live numbers derived from GPS history. All the actual math lives in
 * services/{distance,speed,eta,trackingFormat}.ts — this component only reads
 * session data and renders what those utilities return.
 */
export function TrackingMetricsPanel({ session, now }: TrackingMetricsPanelProps) {
  const isDelivered = session.status === "DELIVERED";
  const { currentLocation, destination, locationHistory } = session;

  const distanceTravelledMeters = useMemo(
    () => calculateDistanceTravelled(locationHistory),
    [locationHistory]
  );

  const speed = useMemo(() => calculateSpeedMetrics(locationHistory), [locationHistory]);

  const distanceToDestinationMeters = useMemo(
    () => (currentLocation && destination ? calculateDistanceToDestination(currentLocation, destination) : null),
    [currentLocation, destination]
  );

  const eta = useMemo(
    () => (distanceToDestinationMeters != null ? calculateETA(distanceToDestinationMeters, speed.current) : null),
    [distanceToDestinationMeters, speed.current]
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Truck size={16} className="text-accent-600 dark:text-accent-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {STAGE_LABELS[session.status]}
        </span>
      </div>

      <div className="mb-4">
        {isDelivered ? (
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Delivered</p>
        ) : distanceToDestinationMeters == null ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Calculating…</p>
        ) : (
          <>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {formatDistance(distanceToDestinationMeters)} away
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{eta ? formatETA(eta) : "ETA calculating…"}</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="DISTANCE TRAVELLED" value={formatDistance(distanceTravelledMeters)} />
        {isDelivered ? (
          <Field label="AVERAGE SPEED" value={speed.average != null ? formatSpeed(speed.average) : "—"} />
        ) : (
          <Field label="CURRENT SPEED" value={speed.current != null ? formatSpeed(speed.current) : "Calculating…"} />
        )}
        <Field
          label="LAST UPDATED"
          value={currentLocation ? formatRelativeTime(currentLocation.timestamp, now) : "—"}
        />
      </div>
    </div>
  );
}
