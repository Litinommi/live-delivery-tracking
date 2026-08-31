# Live Delivery Tracking

A focused, production-quality live delivery tracking product. It does exactly one thing:

```
Create a fake order on your laptop → connect your phone as the delivery partner
→ use the phone's real GPS → send it over the internet → watch it move live on a map.
```

This is **not** a Swiggy/Zomato/Blinkit clone. There is no menu, cart, checkout, login,
or order history — only the tracking experience those apps are famous for.

---

## Overview

- **Customer laptop** (`/`): creates a fake order, gets a tracking code, watches the
  delivery partner move on a live Leaflet/OpenStreetMap map.
- **Delivery phone** (`/mobile`): enters the tracking code, grants location permission,
  and streams real GPS coordinates.
- **Backend**: an Express + Socket.IO server that holds sessions in memory and
  relays GPS points from the phone to the laptop in real time, scoped to one
  Socket.IO room per order.

## Architecture

```
📱 Mobile (delivery partner)              💻 Laptop (customer)
   navigator.geolocation                     React + Leaflet map
   .watchPosition()                          renders live marker
        │                                          ▲
        │ emit "delivery:location"                 │ on "location:update"
        ▼                                          │
   Socket.IO client ────────► ☁️ Backend ──────────► Socket.IO client
                          Express + Socket.IO
                       In-memory TrackingSession
                       room: order:<orderId>
```

Both the mobile browser and the laptop browser open independent HTTPS/WSS
connections to the **same backend**, over the public internet. They never talk
to each other directly, and they do not need to be on the same network.

## Project Structure

```
live-delivery-tracking/
├── client/                    React + Vite + TypeScript + Tailwind + Leaflet
│   ├── src/
│   │   ├── components/        Header, OrderCard, MapView, DeliveryMarker, mobile/…
│   │   ├── pages/              CustomerPage.tsx, MobilePage.tsx
│   │   ├── hooks/              useGeolocation, useSmoothMarker, useSocketConnection…
│   │   ├── services/           api.ts (REST), socket.ts (Socket.IO), geo.ts
│   │   └── types/               shared TS types
│   └── package.json
├── server/                    Node + Express + Socket.IO + TypeScript
│   ├── prisma/schema.prisma   Order + LocationPoint models (Postgres)
│   ├── src/
│   │   ├── routes/orders.ts   REST endpoints
│   │   ├── socket/index.ts    all Socket.IO event handlers
│   │   ├── services/          DB access, delivery lifecycle rules, live socket bindings
│   │   ├── types/              shared TS types
│   │   └── server.ts
│   └── package.json
├── package.json               npm workspaces root (runs both together)
└── README.md
```

## Data Model

```ts
interface TrackingSession {
  orderId: string;              // "ORD-1001"
  trackingCode: string;         // "BQK9XF"
  status: DeliveryStage;        // where the order is in its lifecycle
  deliveryStatus: ConnectionStatus; // whether the partner's socket is actually here
  currentLocation?: LocationPoint;
  locationHistory: LocationPoint[];
  createdAt: number;
}

type DeliveryStage =
  | "ORDER_CREATED"
  | "PARTNER_CONNECTED"
  | "ORDER_PICKED_UP"
  | "ON_THE_WAY"
  | "NEAR_DESTINATION"
  | "DELIVERED";

type ConnectionStatus = "OFFLINE" | "CONNECTED" | "TRACKING" | "RECONNECTING";

interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}
```

`status` and `deliveryStatus` are deliberately independent. `status` is the
delivery **lifecycle** — where the order actually is, start to finish — and
only ever moves forward one stage at a time (enforced centrally in
[`server/src/services/deliveryLifecycle.ts`](server/src/services/deliveryLifecycle.ts)).
`deliveryStatus` is purely the partner's **live connection state** — whether
their socket is actually here right now — and can flap between `CONNECTED`,
`TRACKING`, `RECONNECTING`, and `OFFLINE` without touching the lifecycle at
all. A partner going offline mid-`ON_THE_WAY` doesn't un-become `ON_THE_WAY`.

Orders and their location history are stored in Postgres via Prisma
([`server/prisma/schema.prisma`](server/prisma/schema.prisma)) — they survive
backend restarts and redeploys. The only thing that stays in server memory is
which live socket is currently bound as an order's delivery partner
([`server/src/services/liveState.ts`](server/src/services/liveState.ts)),
since a socket id is meaningless once the process that held the connection is
gone; on boot, any order left non-`OFFLINE` from a previous process's
lifetime is reset, since a fresh process can't have a real live partner
bound yet.

## Real-Time Protocol (Socket.IO)

Each order gets its own room: `order:<orderId>`.

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `customer:join` | client → server (ack) | `{ trackingCode }` | Laptop joins the order's room, receives full session state |
| `delivery:join` | client → server (ack) | `{ trackingCode }` | Phone joins the order's room as the delivery partner; also advances `ORDER_CREATED → PARTNER_CONNECTED` on a first connect |
| `delivery:location` | client → server | `{ trackingCode, latitude, longitude, accuracy, timestamp }` | Phone pushes a GPS point; also advances `ORDER_PICKED_UP → ON_THE_WAY` once movement is confirmed |
| `delivery:advanceStage` | client → server (ack) | `{ trackingCode, targetStage }` | Explicit lifecycle action ("Mark Picked Up" / "Mark Near Destination" / "Mark Delivered") — rejected if not a valid single forward step from the current stage |
| `delivery:stop` | client → server | `{ trackingCode }` | Phone stops tracking (connection state only — doesn't touch the lifecycle) |
| `location:update` | server → client | `LocationPoint` | One new GPS point, broadcast to the room |
| `delivery:status` | server → client | `{ deliveryStatus }` | Partner's connection state: offline / connected / tracking / reconnecting |
| `lifecycle:update` | server → client | `{ stage }` | The order's lifecycle stage changed, broadcast to the room |

**Security (kept intentionally simple):** the server only accepts
`delivery:location` events from the exact socket that previously joined that
order as the delivery partner (`session.deliverySocketId === socket.id`). A
tracking code is the only credential — there is no login system — but a
client only ever receives updates for the room it explicitly joined, so
unrelated orders are never exposed to each other.

### Update strategy (why not stream every GPS callback?)

`watchPosition` can fire several times a second, and phone GPS jitters a few
meters even while stationary. Streaming every callback would flood the socket
and make the marker jitter on the map. Instead ([useLocationBroadcaster.ts](client/src/hooks/useLocationBroadcaster.ts)),
a point is sent only when:

- at least **1s** has passed since the last send, **and**
- either the device moved **≥ 5 meters**, **or 4 seconds** have passed (a
  heartbeat, so the customer still sees "last updated" ticking even while
  the partner is stopped at a signal).

The server additionally enforces a **500ms floor** between accepted points
per session, independent of what the client does.

### Smooth marker movement

The laptop doesn't teleport the marker between GPS points. `useSmoothMarker`
animates the marker's position over ~900ms with an ease-out curve between the
last position and the new one, so movement reads as continuous rather than as
discrete jumps — the polyline route history fills in the rest of the path.

---

## Local Development

Requires Node.js 18+.

```bash
# from the repo root
npm install
npm run dev
```

This starts both the backend (port 4000) and frontend (port 5173) together.
Open:

- Customer: http://localhost:5173/
- Mobile: http://localhost:5173/mobile

Locally, the default `.env` values already point the client at
`http://localhost:4000`. You can test the whole flow on one machine by
opening both URLs in two browser tabs — Chrome will ask for location
permission and use your laptop's own (often Wi-Fi-based, low accuracy) location.

To run each side individually:

```bash
npm run dev -w server   # backend only
npm run dev -w client   # frontend only
```

### Environment variables

**`server/.env`** (copy from `server/.env.example`):

| Variable | Meaning |
|---|---|
| `PORT` | Port the backend listens on. Default `4000`. |
| `CLIENT_ORIGIN` | Comma-separated list of allowed CORS/Socket.IO origins. Must include your deployed frontend's exact HTTPS origin in production. |

**`client/.env`** (copy from `client/.env.example`):

| Variable | Meaning |
|---|---|
| `VITE_SERVER_URL` | Base URL of the backend, no trailing slash. `http://localhost:4000` locally, your deployed backend's HTTPS URL in production. |

---

## Deployment (Internet-Accessible, Required for the Real Test)

The whole point of this app is that the laptop and phone are **not** on the
same network. That only works if the backend is reachable over the public
internet with HTTPS/WSS. Render is used below because its free web services
support WebSockets out of the box; Railway or Fly.io work the same way.

### 1. Deploy the backend (Render)

1. Push this repo to GitHub.
2. In Render: **New → Web Service**, connect the repo.
3. Root directory: `server`
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Add environment variable `CLIENT_ORIGIN` = the frontend URL you'll deploy
   next (e.g. `https://your-app.vercel.app`) — you can update this after
   step 2 once you know the real URL.
7. Deploy. Render gives you an HTTPS URL like `https://your-backend.onrender.com`.
   Socket.IO works over this automatically (Render terminates TLS and
   supports WebSocket upgrades).
8. Verify: open `https://your-backend.onrender.com/health` — should return
   `{"ok":true,...}`.

### 2. Deploy the frontend (Vercel)

1. In Vercel: **New Project**, import the repo.
2. Root directory: `client`
3. Framework preset: Vite (build command `npm run build`, output `dist`).
4. Add environment variable `VITE_SERVER_URL` = `https://your-backend.onrender.com`.
5. Deploy. Vercel gives you `https://your-app.vercel.app` over HTTPS.
6. Go back to Render and set `CLIENT_ORIGIN=https://your-app.vercel.app`,
   then redeploy the backend so CORS/Socket.IO accepts requests from it.

### 3. Configure HTTPS

Both Render and Vercel provision HTTPS automatically for their default
domains — nothing to configure. Browsers require a secure context (HTTPS)
for `navigator.geolocation` on any origin other than `localhost`, so this
step isn't optional: the mobile page will not be able to request GPS access
over plain HTTP once it's off your laptop.

### 4. Verify Socket.IO connectivity

- Open your deployed frontend, open the browser DevTools **Network** tab,
  filter by **WS**. You should see a connection to
  `wss://your-backend.onrender.com/socket.io/...` with status `101 Switching
  Protocols`.
- Or just create an order — the header badge should read **Connected**
  within a second or two.

### 5. Access from mobile data

On your phone (4G/5G, not Wi-Fi), open
`https://your-app.vercel.app/mobile` directly. No LAN, VPN, or shared
Wi-Fi is required — the phone reaches the backend over the same public
internet path as any other website.

---

## Testing Scenario

### Same-room smoke test

1. **Laptop:** open the customer app, click **Create Fake Order**. Note the
   order ID and tracking code (e.g. `ORD-1001` / `ABC123`).
2. **Phone:** open `/mobile`, enter the tracking code, tap **Connect**.
3. Allow the location permission prompt.
4. The phone shows **LIVE TRACKING** and starts streaming GPS.
5. The laptop's header badge changes from *Delivery Partner Offline* →
   *Delivery Partner Connected* → *Live Tracking*, and the marker appears on
   the map.
6. Walk around with the phone — the marker should move, with a trailing
   route line, within a few seconds of each meaningful move.

### Real distance test (the actual point of this app)

1. Create the order on your laptop **at home**, on your home Wi-Fi.
2. Leave the laptop at home, tab open.
3. Take your phone **outside**, switch it to 4G/5G (turn off Wi-Fi to be sure).
4. Connect with the tracking code and start tracking.
5. Walk/drive through several locations — street, shop, another block.
6. Confirm the laptop, still on home Wi-Fi, keeps receiving updates and the
   marker keeps moving — proving the two devices are communicating purely
   through the deployed backend on the public internet, not through any
   shared local network.

---

## Background Location Limitation (Read This Before Relying on It)

This version uses the **browser** Geolocation API (`watchPosition`) from a
normal foreground tab. That is a real limitation, not a bug:

- If the phone's screen locks, or the browser tab goes to the background,
  or the OS suspends the browser process to save battery, **location
  updates will pause or stop** until the tab is active again. This is
  standard behavior for Android and iOS browsers (Safari and Chrome both do
  this) and cannot be fully worked around from web JavaScript.
- This is different from Swiggy/Zomato/Uber's actual delivery apps, which
  are native apps using OS-level background location APIs (foreground
  services on Android, background location modes on iOS) specifically
  exempted from these suspensions.
- For this prototype, prioritize a **working foreground tracking
  experience**: keep the delivery phone's screen on and the tab active
  while testing. If true background tracking is required later, the next
  step is a small native Android/iOS (or React Native / Capacitor) wrapper
  around the same backend and Socket.IO protocol — the server and customer
  app do not need to change at all for that.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Mobile shows "Location permission is required" | The user denied the browser's location prompt. Re-enable it in the site settings (🔒 icon in the address bar) and reload. |
| Mobile stuck on "Unable to determine your location" | GPS/location services are off at the OS level, or the phone has a weak signal indoors. Try outdoors, or enable high-accuracy location mode in phone settings. |
| Mobile page won't request location at all | Geolocation requires a **secure context**. This works on `localhost` in dev, but on a real phone it requires `https://` — confirm your deployed frontend URL starts with `https://`. |
| Laptop badge stuck on "Disconnected" | Backend isn't reachable. Check `VITE_SERVER_URL` in the client's environment matches your actual deployed backend URL, and that the backend is running (`/health` returns 200). |
| Laptop badge flaps between "Connected"/"Reconnecting" | Some hosts spin down free-tier services when idle (e.g. Render free plan sleeps after inactivity) — the first request after a while wakes it up and can take 30–60s. This is a platform behavior, not an app bug. |
| Browser console shows a CORS error | `CLIENT_ORIGIN` on the backend doesn't include your frontend's exact origin (scheme + host, no trailing slash). Update it and redeploy the backend. |
| "Invalid tracking code" on mobile | The order was created on a different backend instance (e.g. testing against localhost while deployed, or the server restarted and lost its in-memory sessions), or the code was mistyped. |
| Works on the same Wi-Fi but not on 4G | Usually a leftover `localhost`/LAN IP in `VITE_SERVER_URL`. It must be the public HTTPS URL of the deployed backend, not a local address. |
| Marker jumps instead of gliding | Expected if GPS points are very far apart (e.g. driving) — the smoothing interpolates between consecutive points, it doesn't invent a road-following path. |
| Everything looks connected but no location ever appears | Confirm the delivery phone actually tapped **Connect** (joins the Socket.IO room) *before* checking the laptop — the customer only receives updates broadcast after both sides have joined the same order's room. |

---

## Design Notes

- **Stack:** React + Vite + TypeScript + Tailwind CSS + Leaflet/react-leaflet
  + OpenStreetMap tiles + lucide-react icons on the frontend; Node + Express
  + Socket.IO + TypeScript on the backend. In-memory store only — no
  database, by design, per the prototype scope.
- **One frontend, two routes:** `/` is the customer experience, `/mobile` is
  the delivery-partner experience. Both are the same deployed static site;
  which one a person sees depends only on the URL they open.
- **No unrelated features:** no login, cart, payments, chat, ratings, order
  history, or admin dashboard. The scope is strictly: fake order → tracking
  code → mobile GPS → internet → backend → WebSocket → laptop → live map.
