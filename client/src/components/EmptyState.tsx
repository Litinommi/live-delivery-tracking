import { PackageSearch, Trash2 } from "lucide-react";
import { OrderSummary } from "../types";

interface EmptyStateProps {
  onCreateOrder: () => void;
  creating: boolean;
  errorMessage: string | null;
  history: OrderSummary[];
  onSelectHistory: (trackingCode: string) => void;
  onDeleteHistory: (trackingCode: string) => void;
}

const STATUS_DOT: Record<OrderSummary["deliveryStatus"], string> = {
  TRACKING: "bg-emerald-500",
  CONNECTED: "bg-accent-500",
  OFFLINE: "bg-slate-300 dark:bg-slate-600",
};

export function EmptyState({
  onCreateOrder,
  creating,
  errorMessage,
  history,
  onSelectHistory,
  onDeleteHistory,
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto py-10">
      <div className="max-w-md w-full text-center animate-fade-in-up">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
          <PackageSearch className="text-accent-600 dark:text-accent-400" size={28} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
          Live Delivery Tracking
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          See your delivery move in real time, the moment it leaves for you.
        </p>
        <button
          onClick={onCreateOrder}
          disabled={creating}
          className="inline-flex items-center justify-center rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white font-medium px-6 py-3 shadow-sm shadow-accent-600/20 active:scale-[0.98] transition-all"
        >
          {creating ? "Creating order…" : "Create Fake Order"}
        </button>
        {errorMessage && <p className="text-sm text-red-500 mt-4">{errorMessage}</p>}

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-6">
            Your live delivery will appear here
          </p>
        ) : (
          <div className="mt-10 text-left">
            <p className="text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              OR CONTINUE A PAST ORDER
            </p>
            <div className="space-y-2">
              {history.slice(0, 6).map((order) => (
                <div
                  key={order.trackingCode}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1 hover:border-accent-300 dark:hover:border-accent-700 transition-colors"
                >
                  <button
                    onClick={() => onSelectHistory(order.trackingCode)}
                    className="flex-1 min-w-0 text-left px-4 py-3 flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[order.deliveryStatus]}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white truncate">
                          {order.orderId}
                        </span>
                        <span className="block text-[11px] font-mono tracking-wider text-slate-400 dark:text-slate-500">
                          {order.trackingCode}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistory(order.trackingCode);
                    }}
                    aria-label={`Delete ${order.orderId}`}
                    className="shrink-0 h-8 w-8 mr-2 flex items-center justify-center rounded-md text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
