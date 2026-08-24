import { useEffect, useState } from "react";
import { getSocket } from "../services/socket";
import { SocketConnectionState } from "../types";

/** Connects the shared socket on mount and tracks its live connection state. */
export function useSocketConnection(): SocketConnectionState {
  const [state, setState] = useState<SocketConnectionState>("disconnected");

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    if (socket.connected) setState("connected");

    const onConnect = () => setState("connected");
    const onDisconnect = () => setState("disconnected");
    const onReconnectAttempt = () => setState("reconnecting");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onConnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onConnect);
    };
  }, []);

  return state;
}
