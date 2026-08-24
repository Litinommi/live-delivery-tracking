import { Marker } from "react-leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { Bike } from "lucide-react";
import { LatLng, useSmoothMarker } from "../hooks/useSmoothMarker";

const icon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="delivery-marker">
      <span className="delivery-marker__ring animate-pulse-ring" />
      <span className="delivery-marker__dot">
        <Bike size={16} strokeWidth={2.5} />
      </span>
    </div>
  ),
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

/** Renders the delivery partner's position, smoothly animating between GPS updates. */
export function DeliveryMarker({ position }: { position: LatLng }) {
  const animated = useSmoothMarker(position);
  const point = animated ?? position;

  return <Marker position={[point.lat, point.lng]} icon={icon} />;
}
