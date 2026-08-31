import { useEffect, useRef, useState } from "react";
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
  removeFromHistory,
  setLastViewedCode,
} from "../services/orderHistory";
import { ConnectionStatus, DeliveryStage, LocationPoint, OrderSummary, TrackingSession } from "../types";

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
    case "RECONNECTING":
      return { variant: "reconnecting", label: "Partner Reconnecting…" };
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
  // Bumped on every fetch AND every direct edit (delete), so a slow, now-stale
  // GET /history response can never clobber a more recent optimistic update.
  const historyRequestIdRef = useRef(0);
  const activeTrackingCodeRef = useRef<string | null>(null);

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
    const requestId = ++historyRequestIdRef.current;
    setHistoryLoading(true);
    api
      .getOrderHistory(getHistoryCodes())
      .then((summaries) => {
        if (historyRequestIdRef.current === requestId) setHistoryOrders(summaries);
      })
      .catch(() => {
        if (historyRequestIdRef.current === requestId) setHistoryOrders([]);
      })
      .finally(() => {
        if (historyRequestIdRef.current === requestId) setHistoryLoading(false);
      });
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

  const handleDeleteOrder = async (trackingCode: string) => {
    const target = historyOrders.find((o) => o.trackingCode === trackingCode);
    const label = target ? `${target.orderId} (${trackingCode})` : trackingCode;
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;

    // Optimistic: reflect the deletion immediately rather than waiting on the network
    // round trip, and roll back if the server call actually fails. Bumping the request
    // id first invalidates any in-flight refreshHistory() fetch, so its (now-stale)
    // result can't land afterward and resurrect the row we just removed.
    historyRequestIdRef.current += 1;
    removeFromHistory(trackingCode);
    setHistoryOrders((prev) => prev.filter((o) => o.trackingCode !== trackingCode));
    if (session?.trackingCode === trackingCode) setSession(null);

    try {
      await api.deleteOrder(trackingCode);
    } catch {
      if (target) {
        addToHistory(trackingCode);
        setHistoryOrders((prev) => [target, ...prev]);
      }
      window.alert("Couldn't delete this order — please try again.");
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
    activeTrackingCodeRef.current = session?.trackingCode ?? null;
  }, [session?.trackingCode]);

  // Socket.IO room membership doesn't survive a reconnect — a new socket id isn't in
  // any room until it re-joins. Without this, a network blip (or the backend spinning
  // back up after Render's free-tier idle sleep) would silently stop delivering
  // updates even once the connection itself is back. "connect" fires on the very
  // first connect too, which just re-sends a harmless duplicate join.
  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => {
      const trackingCode = activeTrackingCodeRef.current;
      if (!trackingCode) return;
      socket.emit("customer:join", { trackingCode }, (ack: JoinAck) => {
        if (ack.ok && ack.session) setSession(ack.session);
      });
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const socket = getSocket();

    const onLocation = (point: LocationPoint) => {
      setSession((prev) =>
        prev ? { ...prev, currentLocation: point, locationHistory: [...prev.locationHistory, point] } : prev
      );
    };
    const onStatus = ({ deliveryStatus }: { deliveryStatus: ConnectionStatus }) => {
      setSession((prev) => (prev ? { ...prev, deliveryStatus } : prev));
    };
    const onLifecycle = ({ stage }: { stage: DeliveryStage }) => {
      setSession((prev) => (prev ? { ...prev, status: stage } : prev));
    };

    socket.on("location:update", onLocation);
    socket.on("delivery:status", onStatus);
    socket.on("lifecycle:update", onLifecycle);
    return () => {
      socket.off("location:update", onLocation);
      socket.off("delivery:status", onStatus);
      socket.off("lifecycle:update", onLifecycle);
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
          onDeleteHistory={handleDeleteOrder}
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
                onDeleteOrder={handleDeleteOrder}
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
