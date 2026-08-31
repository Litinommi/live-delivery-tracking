import { Marker } from "react-leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { Flag } from "lucide-react";
import { GeoPoint } from "../types";

const icon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="delivery-marker">
      <span className="destination-marker__dot">
        <Flag size={14} strokeWidth={2.5} />
      </span>
    </div>
  ),
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

/** The auto-generated destination point — static, so no smoothing needed unlike the delivery marker. */
export function DestinationMarker({ position }: { position: GeoPoint }) {
  return <Marker position={[position.latitude, position.longitude]} icon={icon} />;
}
