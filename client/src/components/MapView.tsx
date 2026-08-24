import { useEffect, useRef, useState } from "react";
import { MapContainer, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { TrackingSession } from "../types";
import { DeliveryMarker } from "./DeliveryMarker";
import { MapControls } from "./MapControls";

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const FOLLOW_ZOOM = 16;

interface FollowControllerProps {
  currentPosition: [number, number] | null;
  isFollowing: boolean;
  onManualDrag: () => void;
}

/** Recenters the map on new locations while following, and disengages on manual drag. */
function FollowController({ currentPosition, isFollowing, onManualDrag }: FollowControllerProps) {
  const map = useMapEvents({ dragstart: onManualDrag });
  const hasCenteredOnce = useRef(false);

  useEffect(() => {
    if (!currentPosition) return;
    if (!hasCenteredOnce.current) {
      map.setView(currentPosition, FOLLOW_ZOOM);
      hasCenteredOnce.current = true;
      return;
    }
    if (isFollowing) {
      map.flyTo(currentPosition, Math.max(map.getZoom(), FOLLOW_ZOOM), { duration: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition?.[0], currentPosition?.[1]]);

  return null;
}

function Toolbar({ isFollowing, onRecenter }: { isFollowing: boolean; onRecenter: () => void }) {
  const map = useMap();
  return (
    <MapControls
      isFollowing={isFollowing}
      onZoomIn={() => map.zoomIn()}
      onZoomOut={() => map.zoomOut()}
      onRecenter={onRecenter}
    />
  );
}

export function MapView({ session }: { session: TrackingSession }) {
  const [isFollowing, setIsFollowing] = useState(true);

  const currentPosition: [number, number] | null = session.currentLocation
    ? [session.currentLocation.latitude, session.currentLocation.longitude]
    : null;

  const route: [number, number][] = session.locationHistory.map((p) => [p.latitude, p.longitude]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={currentPosition ?? DEFAULT_CENTER}
        zoom={currentPosition ? FOLLOW_ZOOM : DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route.length > 1 && (
          <Polyline positions={route} pathOptions={{ color: "#4f46e5", weight: 4, opacity: 0.7 }} />
        )}
        {currentPosition && (
          <DeliveryMarker position={{ lat: currentPosition[0], lng: currentPosition[1] }} />
        )}
        <FollowController
          currentPosition={currentPosition}
          isFollowing={isFollowing}
          onManualDrag={() => setIsFollowing(false)}
        />
        <Toolbar isFollowing={isFollowing} onRecenter={() => setIsFollowing(true)} />
      </MapContainer>

      {!currentPosition && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full text-sm text-slate-500 dark:text-slate-400 shadow text-center">
            Waiting for delivery partner's location…
          </div>
        </div>
      )}
    </div>
  );
}
