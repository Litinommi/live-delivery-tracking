import { useCallback, useEffect, useRef, useState } from "react";

export type GeoErrorType = "PERMISSION_DENIED" | "POSITION_UNAVAILABLE" | "TIMEOUT" | "UNSUPPORTED";

interface GeoState {
  position: GeolocationPosition | null;
  error: GeoErrorType | null;
  watching: boolean;
}

/** Wraps the browser Geolocation API's watchPosition with clean start/stop controls and typed errors. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ position: null, error: null, watching: false });
  const watchIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((s) => ({ ...s, watching: false }));
  }, []);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "UNSUPPORTED" }));
      return;
    }
    setState((s) => ({ ...s, error: null, watching: true }));
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => setState((s) => ({ ...s, position, error: null })),
      (err) => {
        const type: GeoErrorType =
          err.code === err.PERMISSION_DENIED
            ? "PERMISSION_DENIED"
            : err.code === err.POSITION_UNAVAILABLE
              ? "POSITION_UNAVAILABLE"
              : "TIMEOUT";
        setState((s) => ({ ...s, error: type }));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { ...state, start, stop };
}
