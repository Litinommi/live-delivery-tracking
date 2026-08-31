import { DeliveryStage } from "../types";

/**
 * Client-side mirror of the server's stage order — used only to decide which
 * mobile action button to show and to render the progress checklist. The
 * server (server/src/services/deliveryLifecycle.ts) is the actual authority;
 * every transition still gets validated there regardless of what the UI shows.
 */
export const DELIVERY_STAGES: readonly DeliveryStage[] = [
  "ORDER_CREATED",
  "PARTNER_CONNECTED",
  "ORDER_PICKED_UP",
  "ON_THE_WAY",
  "NEAR_DESTINATION",
  "DELIVERED",
];

export const STAGE_LABELS: Record<DeliveryStage, string> = {
  ORDER_CREATED: "Order Created",
  PARTNER_CONNECTED: "Partner Connected",
  ORDER_PICKED_UP: "Picked Up",
  ON_THE_WAY: "On The Way",
  NEAR_DESTINATION: "Near Destination",
  DELIVERED: "Delivered",
};

export function stageIndex(stage: DeliveryStage): number {
  return DELIVERY_STAGES.indexOf(stage);
}

export function nextStage(current: DeliveryStage): DeliveryStage | null {
  const idx = stageIndex(current);
  if (idx === -1 || idx >= DELIVERY_STAGES.length - 1) return null;
  return DELIVERY_STAGES[idx + 1];
}

export function isTerminalStage(stage: DeliveryStage): boolean {
  return stage === DELIVERY_STAGES[DELIVERY_STAGES.length - 1];
}
