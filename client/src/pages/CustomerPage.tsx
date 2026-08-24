import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { EmptyState } from "../components/EmptyState";
import { OrderCard } from "../components/OrderCard";
import { MapView } from "../components/MapView";
import { BadgeVariant } from "../components/ConnectionBadge";
import { useSocketConnection } from "../hooks/useSocketConnection";
import { useTheme } from "../hooks/useTheme";
import { getSocket } from "../services/socket";
import { api } from "../services/api";
import {
  addToHistory,
  clearLastViewedCode,
  getHistoryCodes,
  getLastViewedCode,
  migrateLegacyStorage,
  setLastViewedCode,
} from "../services/orderHistory";
import { DeliveryStatus, LocationPoint, OrderSummary, TrackingSession } from "../types";

interface JoinAck {
  ok: boolean;
  session?: TrackingSession;
  error?: string;
}

function deriveBadge(
  connectionState: ReturnType<typeof useSocketConnection>,
  session: TrackingSession | null
): { variant: BadgeVariant; label: string } {
  if (connectionState === "disconnected") return { variant: "offline", label: "Disconnected" };
  if (connectionState === "reconnecting") return { variant: "reconnecting", label: "Reconnecting…" };
  if (!session) return { variant: "connected", label: "Connected" };

  switch (session.deliveryStatus) {
    case "TRACKING":
      return { variant: "live", label: "Live Tracking" };
    case "CONNECTED":
      return { variant: "connected", label: "Delivery Partner Connected" };
    default:
      return { variant: "offline", label: "Delivery Partner Offline" };
  }
}

export function CustomerPage() {
  const { theme, toggle } = useTheme();
  const connectionState = useSocketConnection();
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [historyOrders, setHistoryOrders] = useState<OrderSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const joinAsCustomer = (trackingCode: string) => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit("customer:join", { trackingCode }, (ack: JoinAck) => {
      if (ack.ok && ack.session) {
        setSession(ack.session);
      } else {
        clearLastViewedCode();
        setSession(null);
      }
    });
  };

  const refreshHistory = () => {
    setHistoryLoading(true);
    api
      .getOrderHistory(getHistoryCodes())
      .then(setHistoryOrders)
      .catch(() => setHistoryOrders([]))
      .finally(() => setHistoryLoading(false));
  };

  const handleCreateOrder = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await api.createOrder();
      addToHistory(created.trackingCode);
      setLastViewedCode(created.trackingCode);
      setSession(created);
      joinAsCustomer(created.trackingCode);
      refreshHistory();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create order.");
    } finally {
      setCreating(false);
    }
  };

  const handleNewOrder = () => {
    clearLastViewedCode();
    setSession(null);
  };

  const handleViewOrder = async (trackingCode: string) => {
    setLastViewedCode(trackingCode);
    try {
      const existing = await api.getOrderByTrackingCode(trackingCode);
      setSession(existing);
      joinAsCustomer(trackingCode);
    } catch {
      clearLastViewedCode();
    }
  };

  // On load, re-attach to whatever order this browser last viewed, if it still exists on the server.
  useEffect(() => {
    migrateLegacyStorage();
    refreshHistory();

    const storedCode = getLastViewedCode();
    if (!storedCode) return;

    let cancelled = false;
    api
      .getOrderByTrackingCode(storedCode)
      .then((existing) => {
        if (cancelled) return;
        setSession(existing);
        joinAsCustomer(storedCode);
      })
      .catch(() => {
        clearLastViewedCode();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    const socket = getSocket();

    const onLocation = (point: LocationPoint) => {
      setSession((prev) =>
        prev ? { ...prev, currentLocation: point, locationHistory: [...prev.locationHistory, point] } : prev
      );
    };
    const onStatus = ({ deliveryStatus }: { deliveryStatus: DeliveryStatus }) => {
      setSession((prev) => (prev ? { ...prev, deliveryStatus } : prev));
    };

    socket.on("location:update", onLocation);
    socket.on("delivery:status", onStatus);
    return () => {
      socket.off("location:update", onLocation);
      socket.off("delivery:status", onStatus);
    };
  }, [session?.trackingCode]);

  const badge = deriveBadge(connectionState, session);

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Header
        badgeVariant={badge.variant}
        badgeLabel={badge.label}
        theme={theme}
        onToggleTheme={toggle}
        subtitle="Live Delivery"
      />

      {!session ? (
        <EmptyState
          onCreateOrder={handleCreateOrder}
          creating={creating}
          errorMessage={createError}
          history={historyOrders}
          onSelectHistory={handleViewOrder}
        />
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <div className="order-2 md:order-1 md:w-[380px] lg:w-[420px] shrink-0 md:border-r border-slate-200 dark:border-slate-800 md:overflow-y-auto -mt-6 md:mt-0 relative z-10">
            <div className="bg-white dark:bg-slate-900 md:bg-transparent rounded-t-3xl md:rounded-none shadow-[0_-8px_30px_rgba(0,0,0,0.08)] md:shadow-none p-5 md:p-6 animate-fade-in-up">
              <OrderCard
                session={session}
                history={historyOrders}
                historyLoading={historyLoading}
                onSelectOrder={handleViewOrder}
                onNewOrder={handleNewOrder}
                onOpenSwitcher={refreshHistory}
              />
            </div>
          </div>
          <div className="order-1 md:order-2 flex-1 min-h-[55vh] md:min-h-0 relative">
            <MapView session={session} />
          </div>
        </div>
      )}
    </div>
  );
}
