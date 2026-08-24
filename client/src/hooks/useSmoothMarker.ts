import { useEffect, useRef, useState } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates between successive marker positions instead of teleporting the marker.
 * Returns the currently interpolated position for the given target.
 */
export function useSmoothMarker(target: LatLng | null, durationMs = 900): LatLng | null {
  const [animated, setAnimated] = useState<LatLng | null>(target);
  const animatedRef = useRef<LatLng | null>(target);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!target) return;
    const from = animatedRef.current ?? target;
    const to = target;
    if (from.lat === to.lat && from.lng === to.lng) return;

    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(t);
      const next = {
        lat: from.lat + (to.lat - from.lat) * eased,
        lng: from.lng + (to.lng - from.lng) * eased,
      };
      animatedRef.current = next;
      setAnimated(next);
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // Re-run only when the target coordinate actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, durationMs]);

  return animated;
}
