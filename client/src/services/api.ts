import { TrackingSession } from "../types";

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
};
