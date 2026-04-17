# Mall263 mobile (Expo)

Native shell for Mall263. The Next.js web app in `/frontend` is unchanged; this app calls the same Nest API.

## Prerequisites

- Node 20+
- Backend running locally (default `http://localhost:4000`) or a reachable staging URL
- From the **repository root**, install workspaces: `npm install`

## Configure API URL

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.

- **Android emulator**: `http://10.0.2.2:4000` maps to the host machine’s localhost.
- **iOS simulator**: `http://localhost:4000` usually works.
- **Physical device**: use your computer’s LAN IP, e.g. `http://192.168.1.10:4000`.

## Run

From repo root:

```bash
npm run dev:mobile
```

Or from this folder:

```bash
npm run start
```

Then open in Expo Go or press `a` / `i` for emulator.

## Current scope

- Phone + password sign-in
- Secure token storage
- Token refresh on 401
- Home tab with profile summary and sign-out
- **Shop** tab: product list (paginated, pull-to-refresh) via `GET /api/v1/products/browse`, plus **search** via `GET /api/v1/search`
- **Product** screen: `GET /api/v1/products/:id` (tap a row in Shop)

See **`docs/MOBILE_BUILD_PLAN.md`** in the repo for the full ordered checklist toward web parity.
