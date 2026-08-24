import { Router } from "express";
import { createSession, deleteOrder, findOrderWithHistory, getOrderSummaries } from "../services/sessionStore";

export const ordersRouter = Router();

/** Create a fake order and its tracking session. Called by the customer laptop. */
ordersRouter.post("/orders", async (_req, res) => {
  const session = await createSession();
  res.status(201).json(session);
});

/**
 * Order history for a browser's own past orders. The browser is the only thing that
 * remembers which tracking codes it created (localStorage) — this just resolves
 * those codes into current summaries. No code, no visibility into anyone else's orders.
 */
ordersRouter.get("/orders/history", async (req, res) => {
  const raw = typeof req.query.codes === "string" ? req.query.codes : "";
  const codes = raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 50);
  const summaries = await getOrderSummaries(codes);
  res.json(summaries);
});

/** Look up a session by tracking code. Called by the mobile app to validate a code before connecting. */
ordersRouter.get("/orders/:trackingCode", async (req, res) => {
  const found = await findOrderWithHistory(req.params.trackingCode);
  if (!found) {
    res.status(404).json({ error: "Invalid tracking code." });
    return;
  }
  res.json(found.session);
});

/** Permanently deletes an order and its location history. */
ordersRouter.delete("/orders/:trackingCode", async (req, res) => {
  const deleted = await deleteOrder(req.params.trackingCode);
  if (!deleted) {
    res.status(404).json({ error: "Invalid tracking code." });
    return;
  }
  res.status(204).end();
});
