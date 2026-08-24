import { Clock, X } from "lucide-react";
import { OrderSummary } from "../types";

interface OrderHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  orders: OrderSummary[];
  loading: boolean;
  activeTrackingCode?: string;
  onSelect: (trackingCode: string) => void;
}

const STATUS_COPY: Record<OrderSummary["deliveryStatus"], { label: string; dot: string }> = {
  TRACKING: { label: "Live", dot: "bg-emerald-500" },
  CONNECTED: { label: "Connected", dot: "bg-accent-500" },
  OFFLINE: { label: "Offline", dot: "bg-slate-300 dark:bg-slate-600" },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderHistoryPanel({
  open,
  onClose,
  orders,
  loading,
  activeTrackingCode,
  onSelect,
}: OrderHistoryPanelProps) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-slate-950/40 z-40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Order history</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-3.5rem)] p-3">
          {loading && <p className="text-sm text-slate-400 text-center py-8">Loading…</p>}
          {!loading && orders.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No past orders on this browser yet.</p>
          )}
          <div className="space-y-2">
            {orders.map((order) => {
              const isActive = order.trackingCode === activeTrackingCode;
              const status = STATUS_COPY[order.deliveryStatus];
              return (
                <button
                  key={order.trackingCode}
                  onClick={() => onSelect(order.trackingCode)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    isActive
                      ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {order.orderId}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs font-mono tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    {order.trackingCode}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(order.createdAt)}</p>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
