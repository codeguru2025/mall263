# Mall263 mobile app — solo build plan

**Who this is for:** just you (and your AI assistant) — keep steps small and check them off as you go.

You are building **one native app** (Expo) that talks to the **same Nest API** as the website. The website code stays in `frontend/`; mobile lives in `apps/mobile/`. Work **one vertical slice at a time**, test on **real Android + iPhone** against your **public staging API** when possible.

---

## Principles (so nothing breaks)

1. **Do not change** `frontend/` or Docker/DO paths unless a task explicitly says so.
2. **Prefer public HTTPS** API URLs on devices (`EXPO_PUBLIC_API_URL`); avoid relying on laptop LAN when the phone is the hotspot.
3. **Ship a thin slice**: screen + API + loading/error + sign-out still works.
4. **After each slice**: run the app on a device, sign in, tap through the new flow, sign out.

---

## Phase 0 — Environment (you)

- [x] `apps/mobile/.env` with `EXPO_PUBLIC_API_URL` (gitignored — not committed; matches production DO host).
- [x] Same value documented in `.env.example` for reference.
- [ ] From repo root: `npm install` then `npm run dev:mobile`; open app on **Android** and **iPhone** (Expo Go or dev build).
- [ ] Confirm **login** + **Shop** + **search** work on device against that URL.

---

## Phase 1 — Shell & navigation (done / maintain)

- [x] Expo app + workspaces (`apps/mobile`, `packages/shared`).
- [x] Secure token storage, login, refresh on 401, logout, protected tabs.
- [ ] **You:** Rename app display name / icons when you want a branded store build (EAS later).
- [ ] **You:** `eas init` + first **internal** builds when ready (Apple + Google accounts you already have).

---

## Phase 2 — Buyer: discover products

- [x] **Shop tab** — list products from `GET /api/v1/products/browse` (public), pagination, pull-to-refresh, image + title + price range.
- [x] Product **detail** screen — `GET /api/v1/products/:id` (`app/product/[id].tsx`), title/price/description + hero image.
- [ ] **Back navigation polish** — header titles from product name (optional).
- [x] **Search** — Shop search bar (debounced) → `GET /api/v1/search?q=...` (same Meili/DB fallback as backend); empty query → browse feed.
- [ ] **Categories / filters** — match web query params as needed.

---

## Phase 3 — Buyer: account & trust

- [x] Profile tab — view/edit name via `GET` / `PATCH /api/v1/users/me`; wallet + trust + merchant when API returns them.
- [x] Notifications — `GET /api/v1/notifications` (pagination, All/Unread), tap row → `PATCH .../:id/read`, “Mark all” → `PATCH .../read-all`.
- [x] Trust score on profile when `trustScore` is present on `/users/me`.

---

## Phase 4 — Buyer: demands & chat (current focus)

- [x] Buyer demands — **Demands** tab: `GET /api/v1/demands/my` (All / Open), **Post** → `POST /api/v1/demands`, detail `GET .../demands/:id`, **Accept** → `POST .../demands/offers/:offerId/accept` (wallet lock rules apply after trial — see backend `createDemand`).
- [x] Seller path on mobile: browse `GET .../demands/open`, submit `POST .../demands/:demandId/offers` (stall + one line item from stall catalog). Attendant stalls included on `GET /users/me` as `attendantStall` (Prisma relation name).
- [ ] Chat rooms / messages — socket lifecycle on mobile, reconnect, unread.

---

## Phase 5 — Wallet (read then write)

- [ ] Balances + transaction history (read-only first).
- [ ] Deposits / Paynow — **design return URLs + deep links** (`mall263` URL scheme in `app.json`) with backend; test on both OS.
- [ ] Transfers / locks — only after reads are solid.

---

## Phase 6 — Seller: stall & inventory

- [ ] Merchant/stall context from API.
- [ ] Product CRUD, variants, inventory — **camera** uploads via existing `/upload` patterns.

---

## Phase 7 — POS

- [ ] Fast cart / checkout flows; device UX (scanner, receipts) as needed.

---

## Phase 8 — Field agent

- [ ] Offline queue, sync, retries — larger effort; align with `agents` module.

---

## Phase 9 — Admin / ops (mobile)

- [ ] Only screens you truly need on a phone; mirror `admin` API routes with role guards.

---

## Phase 10 — Hardening

- [ ] Sentry (or similar) on mobile builds.
- [ ] EAS Build pipelines (staging vs production env).
- [ ] EAS Update (optional) for JS-only fixes.
- [ ] App Store / Play listing assets, privacy policy URL, review notes.

---

## Shared code (when it hurts to duplicate)

- Move repeated **API types**, **Zod** shapes, and **client helpers** into `packages/shared` or a new `packages/api-client` consumed by **both** `frontend` and `apps/mobile`.

---

## “Done for the day” checklist

- [ ] New code runs on **Android + iOS** against staging.
- [ ] No secrets committed (`.env` gitignored).
- [ ] `CLAUDE.md` + this file still match reality (update if you changed scope).
