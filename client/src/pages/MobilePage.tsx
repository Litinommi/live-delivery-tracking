import { useState } from "react";
import { Header } from "../components/Header";
import { ConnectScreen } from "../components/mobile/ConnectScreen";
import { TrackingScreen } from "../components/mobile/TrackingScreen";
import { BadgeVariant } from "../components/ConnectionBadge";
import { useSocketConnection } from "../hooks/useSocketConnection";
import { useTheme } from "../hooks/useTheme";
import { getSocket } from "../services/socket";
import { api } from "../services/api";
import { TrackingSession } from "../types";

interface JoinAck {
  ok: boolean;
  session?: TrackingSession;
  error?: string;
}

export function MobilePage() {
  const { theme, toggle } = useTheme();
  const connectionState = useSocketConnection();
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = async (code: string) => {
    setConnecting(true);
    setConnectError(null);
    try {
      await api.getOrderByTrackingCode(code);
      const socket = getSocket();
      if (!socket.connected) socket.connect();
      socket.emit("delivery:join", { trackingCode: code }, (ack: JoinAck) => {
        setConnecting(false);
        if (ack.ok && ack.session) {
          setSession(ack.session);
        } else {
          setConnectError(ack.error ?? "Unable to connect.");
        }
      });
    } catch (err) {
      setConnecting(false);
      setConnectError(err instanceof Error ? err.message : "Invalid tracking code.");
    }
  };

  const badge: { variant: BadgeVariant; label: string } =
    connectionState === "disconnected"
      ? { variant: "offline", label: "Disconnected" }
      : connectionState === "reconnecting"
        ? { variant: "reconnecting", label: "Reconnecting…" }
        : { variant: "connected", label: "Connected" };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Header badgeVariant={badge.variant} badgeLabel={badge.label} theme={theme} onToggleTheme={toggle} />
      {!session ? (
        <ConnectScreen onConnect={handleConnect} connecting={connecting} errorMessage={connectError} />
      ) : (
        <TrackingScreen session={session} connectionState={connectionState} />
      )}
    </div>
  );
}
