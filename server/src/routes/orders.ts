import { Router } from "express";
import { createSession, getSession, toPublicSession } from "../services/sessionStore";

export const ordersRouter = Router();

/** Create a fake order and its tracking session. Called by the customer laptop. */
ordersRouter.post("/orders", (_req, res) => {
  const session = createSession();
  res.status(201).json(toPublicSession(session));
});

/** Look up a session by tracking code. Called by the mobile app to validate a code before connecting. */
ordersRouter.get("/orders/:trackingCode", (req, res) => {
  const session = getSession(req.params.trackingCode);
  if (!session) {
    res.status(404).json({ error: "Invalid tracking code." });
    return;
  }
  res.json(toPublicSession(session));
});
