const HISTORY_KEY = "ldt:orderHistory";
const LAST_VIEWED_KEY = "ldt:lastViewedCode";
const LEGACY_SINGLE_ORDER_KEY = "ldt:customerTrackingCode";
const MAX_HISTORY = 20;

/** Tracking codes this browser has created, newest first. This is the only place that concept lives — there's no login, so "your orders" means "orders this browser knows about." */
export function getHistoryCodes(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export function addToHistory(trackingCode: string): void {
  const codes = getHistoryCodes().filter((c) => c !== trackingCode);
  codes.unshift(trackingCode);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(codes.slice(0, MAX_HISTORY)));
}

export function getLastViewedCode(): string | null {
  return localStorage.getItem(LAST_VIEWED_KEY);
}

export function setLastViewedCode(trackingCode: string): void {
  localStorage.setItem(LAST_VIEWED_KEY, trackingCode);
}

export function clearLastViewedCode(): void {
  localStorage.removeItem(LAST_VIEWED_KEY);
}

/** One-time migration from the older single-order persistence key. */
export function migrateLegacyStorage(): void {
  const legacy = localStorage.getItem(LEGACY_SINGLE_ORDER_KEY);
  if (!legacy) return;
  addToHistory(legacy);
  setLastViewedCode(legacy);
  localStorage.removeItem(LEGACY_SINGLE_ORDER_KEY);
}
