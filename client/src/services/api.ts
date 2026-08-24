import { OrderSummary, TrackingSession } from "../types";

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createOrder(): Promise<TrackingSession> {
    return fetch(`${SERVER_URL}/api/orders`, { method: "POST" }).then((r) =>
      handle<TrackingSession>(r)
    );
  },
  getOrderByTrackingCode(trackingCode: string): Promise<TrackingSession> {
    return fetch(`${SERVER_URL}/api/orders/${encodeURIComponent(trackingCode)}`).then((r) =>
      handle<TrackingSession>(r)
    );
  },
  getOrderHistory(trackingCodes: string[]): Promise<OrderSummary[]> {
    if (trackingCodes.length === 0) return Promise.resolve([]);
    const codes = encodeURIComponent(trackingCodes.join(","));
    return fetch(`${SERVER_URL}/api/orders/history?codes=${codes}`).then((r) =>
      handle<OrderSummary[]>(r)
    );
  },
  deleteOrder(trackingCode: string): Promise<void> {
    return fetch(`${SERVER_URL}/api/orders/${encodeURIComponent(trackingCode)}`, {
      method: "DELETE",
    }).then((r) => {
      if (!r.ok && r.status !== 404) throw new Error("Failed to delete order.");
    });
  },
};
