import { useEffect, useState } from "react";
import { OrderSummary, TrackingSession } from "../types";
import { formatRelativeTime } from "../services/geo";
import { OrderSwitcher } from "./OrderSwitcher";
import { DeliveryStageTimeline } from "./DeliveryStageTimeline";

const DELIVERY_STATUS_COPY: Record<TrackingSession["deliveryStatus"], string> = {
  OFFLINE: "Waiting for delivery partner to connect",
  CONNECTED: "Delivery partner connected — waiting for GPS",
  TRACKING: "Your delivery partner is moving",
  RECONNECTING: "Delivery partner's connection dropped — reconnecting…",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
        {label}
      </p>
      <p className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}

interface OrderCardProps {
  session: TrackingSession;
  history: OrderSummary[];
  historyLoading: boolean;
  onSelectOrder: (trackingCode: string) => void;
  onDeleteOrder: (trackingCode: string) => void;
  onNewOrder: () => void;
  onOpenSwitcher: () => void;
}

export function OrderCard({
  session,
  history,
  historyLoading,
  onSelectOrder,
  onDeleteOrder,
  onNewOrder,
  onOpenSwitcher,
}: OrderCardProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loc = session.currentLocation;
  const isTracking = session.deliveryStatus === "TRACKING";
  const isReconnecting = session.deliveryStatus === "RECONNECTING";

  return (
    <div className="space-y-5">
      <OrderSwitcher
        currentOrderId={session.orderId}
        orders={history}
        loading={historyLoading}
        activeTrackingCode={session.trackingCode}
        onSelect={onSelectOrder}
        onDelete={onDeleteOrder}
        onNewOrder={onNewOrder}
        onOpen={onOpenSwitcher}
      />

      <div>
        <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
          CONNECTION
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isTracking
                ? "bg-emerald-500 animate-pulse"
                : isReconnecting
                  ? "bg-amber-500 animate-pulse"
                  : "bg-slate-300 dark:bg-slate-600"
            }`}
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {DELIVERY_STATUS_COPY[session.deliveryStatus]}
          </span>
        </div>
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      <div>
        <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-3">
          DELIVERY STATUS
        </p>
        <DeliveryStageTimeline currentStage={session.status} />
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      <div>
        <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
          TRACKING CODE
        </p>
        <p className="text-lg font-mono font-semibold tracking-[0.2em] text-accent-600 dark:text-accent-400">
          {session.trackingCode}
        </p>
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div className="col-span-2">
          <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
            CURRENT LOCATION
          </p>
          <p className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">
            {loc ? loc.latitude.toFixed(5) : "—"}
          </p>
          <p className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">
            {loc ? loc.longitude.toFixed(5) : "—"}
          </p>
        </div>
        <Field label="GPS ACCURACY" value={loc?.accuracy != null ? `${Math.round(loc.accuracy)}m` : "—"} />
        <Field label="UPDATED" value={loc ? formatRelativeTime(loc.timestamp, now) : "—"} />
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      <Field
        label="ROUTE TRAVELLED"
        value={`${session.locationHistory.length} point${session.locationHistory.length === 1 ? "" : "s"} recorded`}
      />
    </div>
  );
}
