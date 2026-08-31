import { DeliveryStage } from "../types";

/**
 * The one place that knows what order delivery stages happen in. Everything
 * else — sockets, REST, the DB layer — asks this module rather than
 * comparing strings itself, so there is exactly one definition of "valid"
 * to keep correct.
 */
export const DELIVERY_STAGES: readonly DeliveryStage[] = [
  "ORDER_CREATED",
  "PARTNER_CONNECTED",
  "ORDER_PICKED_UP",
  "ON_THE_WAY",
  "NEAR_DESTINATION",
  "DELIVERED",
];

export const INITIAL_STAGE: DeliveryStage = DELIVERY_STAGES[0];

/** The lifecycle only ever moves forward one stage at a time — no skipping ahead, no going back. */
export function canTransition(from: DeliveryStage, to: DeliveryStage): boolean {
  const fromIndex = DELIVERY_STAGES.indexOf(from);
  const toIndex = DELIVERY_STAGES.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

export function nextStage(current: DeliveryStage): DeliveryStage | null {
  const idx = DELIVERY_STAGES.indexOf(current);
  if (idx === -1 || idx >= DELIVERY_STAGES.length - 1) return null;
  return DELIVERY_STAGES[idx + 1];
}

export function isTerminalStage(stage: DeliveryStage): boolean {
  return stage === DELIVERY_STAGES[DELIVERY_STAGES.length - 1];
}
