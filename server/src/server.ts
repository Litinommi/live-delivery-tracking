import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { ordersRouter } from "./routes/orders";
import { registerSocketHandlers } from "./socket";

const PORT = Number(process.env.PORT) || 4000;
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "live-delivery-tracking-server" });
});

app.use("/api", ordersRouter);

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Live Delivery Tracking server listening on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
