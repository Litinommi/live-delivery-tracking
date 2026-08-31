import { EtaResult } from "./eta";

/** "850 m" below 1km, "3.42 km" up to 10km, "12.3 km" beyond — more decimals would be false precision at that range. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
}

export function formatSpeed(kmh: number): string {
  return `${Math.round(kmh)} km/h`;
}

export function formatETA(eta: EtaResult): string {
  if (eta.kind === "arriving") return "Arriving soon";
  if (eta.kind === "unavailable") return "ETA calculating…";

  const totalMinutes = Math.round(eta.seconds / 60);
  if (totalMinutes < 1) return "Arriving soon";
  if (totalMinutes < 60) return `~${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `~${hours}h ${minutes}min` : `~${hours}h`;
}
