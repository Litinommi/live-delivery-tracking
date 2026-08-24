import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { OrderSummary } from "../types";

interface OrderSwitcherProps {
  currentOrderId: string;
  orders: OrderSummary[];
  loading: boolean;
  activeTrackingCode?: string;
  onSelect: (trackingCode: string) => void;
  onDelete: (trackingCode: string) => void;
  onNewOrder: () => void;
  onOpen: () => void;
}

const STATUS_DOT: Record<OrderSummary["deliveryStatus"], string> = {
  TRACKING: "bg-emerald-500",
  CONNECTED: "bg-accent-500",
  OFFLINE: "bg-slate-300 dark:bg-slate-600",
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderSwitcher({
  currentOrderId,
  orders,
  loading,
  activeTrackingCode,
  onSelect,
  onDelete,
  onNewOrder,
  onOpen,
}: OrderSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open) onOpen();
    setOpen((v) => !v);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 group"
      >
        <div className="text-left">
          <p className="text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
            ORDER
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentOrderId}</h2>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform group-hover:text-slate-600 dark:group-hover:text-slate-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-fade-in-up">
          <div className="max-h-72 overflow-y-auto p-1.5">
            {loading && <p className="text-sm text-slate-400 text-center py-4">Loading…</p>}
            {!loading && orders.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No past orders yet.</p>
            )}
            {orders.map((order) => {
              const isActive = order.trackingCode === activeTrackingCode;
              return (
                <div
                  key={order.trackingCode}
                  className={`rounded-lg flex items-center gap-1 transition-colors ${
                    isActive
                      ? "bg-accent-50 dark:bg-accent-900/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <button
                    onClick={() => {
                      setOpen(false);
                      onSelect(order.trackingCode);
                    }}
                    className="flex-1 min-w-0 text-left px-3 py-2 flex items-center justify-between gap-2"
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
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {formatDate(order.createdAt)}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(order.trackingCode);
                    }}
                    aria-label={`Delete ${order.orderId}`}
                    className="shrink-0 h-7 w-7 mr-1 flex items-center justify-center rounded-md text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onNewOrder();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-accent-600 dark:text-accent-400 border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <Plus size={15} /> New order
          </button>
        </div>
      )}
    </div>
  );
}
