import { useEffect, useState } from "react";
import { AlertTriangle, Bike } from "lucide-react";
import { SocketConnectionState, TrackingSession } from "../../types";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useLocationBroadcaster } from "../../hooks/useLocationBroadcaster";
import { formatRelativeTime } from "../../services/geo";
import { getSocket } from "../../services/socket";

interface TrackingScreenProps {
  session: TrackingSession;
  connectionState: SocketConnectionState;
}

const GEO_ERROR_COPY: Record<string, string> = {
  PERMISSION_DENIED: "Location permission is required. Please enable location access.",
  POSITION_UNAVAILABLE: "Unable to determine your location. Trying again…",
  TIMEOUT: "Unable to determine your location. Trying again…",
  UNSUPPORTED: "This browser does not support location tracking.",
};

export function TrackingScreen({ session, connectionState }: TrackingScreenProps) {
  const geo = useGeolocation();
  const [trackingActive, setTrackingActive] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    geo.start();
    return () => geo.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useLocationBroadcaster(session.trackingCode, geo.position, trackingActive);

  const handleToggle = () => {
    if (trackingActive) {
      geo.stop();
      getSocket().emit("delivery:stop", { trackingCode: session.trackingCode });
      setTrackingActive(false);
    } else {
      geo.start();
      setTrackingActive(true);
    }
  };

  const coords = geo.position?.coords;
  const lastUpdateTs = geo.position?.timestamp;

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-8 max-w-md w-full mx-auto">
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
          ORDER
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{session.orderId}</h1>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            trackingActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"
          }`}
        />
        <span className="text-sm font-bold tracking-wide text-slate-700 dark:text-slate-200">
          {trackingActive ? "LIVE TRACKING" : "TRACKING STOPPED"}
        </span>
      </div>

      {connectionState !== "connected" && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm px-4 py-3 mb-4">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Connection lost. Waiting for internet…</span>
        </div>
      )}

      {geo.error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 mb-4">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{GEO_ERROR_COPY[geo.error]}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 mb-6 flex-1">
        <div className="flex items-center gap-2 mb-4 text-accent-600 dark:text-accent-400">
          <Bike size={18} />
          <span className="text-sm font-semibold">Your current location</span>
        </div>

        <p className="text-2xl font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
          {coords ? coords.latitude.toFixed(5) : "—"}
        </p>
        <p className="text-2xl font-mono font-semibold text-slate-900 dark:text-white tabular-nums mb-6">
          {coords ? coords.longitude.toFixed(5) : "—"}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              GPS ACCURACY
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {coords?.accuracy != null ? `${Math.round(coords.accuracy)}m` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              LAST UPDATE
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {lastUpdateTs ? formatRelativeTime(lastUpdateTs, now) : "—"}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleToggle}
        className={`w-full rounded-xl py-4 text-base font-semibold shadow-sm active:scale-[0.98] transition-all ${
          trackingActive
            ? "bg-red-600 hover:bg-red-700 text-white shadow-red-600/20"
            : "bg-accent-600 hover:bg-accent-700 text-white shadow-accent-600/20"
        }`}
      >
        {trackingActive ? "STOP TRACKING" : "RESUME TRACKING"}
      </button>
    </div>
  );
}
