# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Mall263 is a marketplace platform for informal African retail (Zimbabwe-focused). It features a NestJS backend, Next.js web frontend, an **Expo (React Native) mobile app** in `apps/mobile` (same API as web), PostgreSQL + Prisma, Redis/BullMQ queues, Meilisearch full-text search, DigitalOcean Spaces storage, and Paynow Zimbabwe payments.

## Commands

### Local Development Setup

```bash
# Start infrastructure (PostgreSQL, Redis, Meilisearch)
docker-compose up -d postgres redis meilisearch

# Backend (port 4000)
cd backend && npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed       # Creates 4 test accounts (admin/merchant/buyer/agent)
npm run dev

# Frontend (port 3000, separate terminal)
cd frontend && npm install && npm run dev

# Mobile (Expo — real native shell; separate from Next.js)
# From repo root (installs workspaces including apps/mobile):
npm install
npm run dev:mobile
```

Copy `apps/mobile/.env.example` → `apps/mobile/.env` and set **`EXPO_PUBLIC_API_URL`** to your API **origin only** (no `/api/v1` suffix), same idea as web `NEXT_PUBLIC_API_URL`.

**Testing on real Android and iPhone:** Prefer a **public HTTPS URL** (staging or production API) so the phone can reach the backend without your laptop firewall, LAN quirks, or “phone hotspot to laptop” port-forwarding pain. Example: `https://your-api.example.com` (whatever host your deployed Nest app uses). Local-only URLs often fail on device unless you use emulator loopback tricks.

**Store distribution:** Apple Developer + Google Play Console accounts are available for future **EAS Build** / store releases. Until then, use **Expo Go** or **internal dev builds** for QA.

Test accounts after seeding:

| Role | Phone | Password |
|------|-------|----------|
| Admin | +263770000001 | admin123456 |
| Merchant | +263771000001 | merchant123 |
| Buyer | +263772000001 | buyer12345 |
| Agent | +263773000001 | agent12345 |

**Super admin (seed):** `backend/prisma/seed.ts` reads **`SUPERADMIN_PHONE`** and **`SUPERADMIN_PASSWORD`** from the environment (required to run seed). The table above may match your `.env` or docs; if seed vars differ, use those credentials.

API docs: `http://localhost:4000/docs` (Swagger)

### Build & Lint

```bash
# From repo root
npm run build:backend     # Compiles backend TypeScript
npm run build:frontend    # Next.js production build

# From backend/ or frontend/
npm run lint              # ESLint with auto-fix
npm run build             # Compile/optimize
```

Mobile does not use `build:frontend`; run `npm run start -w @mall263/mobile` (or `npm run dev:mobile` from root) for the Expo dev server.

### Database

```bash
# From backend/
npx prisma migrate dev           # Create + apply migration
npx prisma migrate deploy        # Apply only (production)
npx prisma studio                # GUI at localhost:5555
npm run db:seed                  # Re-seed test data
```

### Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Architecture

### Monorepo Structure

```
mall263/
├── backend/              NestJS API (port 4000 local)
├── frontend/             Next.js App Router (port 3000) — primary web UI (unchanged paths for Docker / DO)
├── apps/mobile/          Expo (React Native) — native clients; same JWT API as web
├── packages/shared/      Tiny shared helpers (e.g. password length text); expand over time
├── prisma/               Migrations + seed scripts
├── package.json          npm workspaces: apps/*, packages/*
└── docker-compose.yml
```

**Important:** Docker and DigitalOcean configs still point at **`frontend/`** only. The mobile app is **not** part of those web builds; it ships via **Expo / EAS** when you are ready.

### Backend Modules (`backend/src/modules/`)

Key domain modules and their responsibilities:

- **auth** — JWT + refresh tokens, phone-based registration, `OptionalJwtAuthGuard` for public routes that optionally enrich with user context
- **wallet** — Double-entry ledger; all financial operations use `$transaction()` with Serializable isolation. `available` and `locked` balances tracked separately.
- **inventory** — Race condition protection via `FOR UPDATE` locks on last-item purchases; commission pre-flight check before any sale
- **pos** — Point-of-sale transactions for stall attendants; `POSSale` → `POSSaleItem` → `Receipt`
- **demands** — Buyer demand posts + seller bidding (`BuyerDemand` / `SellerOffer`). 10% of bid value locked in wallet until accepted/rejected.
- **agents** — Field agent offline task queue; onboard merchants and capture products with images without connectivity
- **trust** — Trust scores and anomaly detection per user
- **audit** — Compliance logging of all state changes (`AuditLog`)
- **search** — Meilisearch integration with typo tolerance and faceted filtering
- **subscriptions** — POS subscription tiers (basic/premium); 7-day free trial for new accounts
- **upload** — Sharp-based WebP compression before upload to DigitalOcean Spaces

### Frontend Structure (`frontend/src/app/`)

App Router pages: `/marketplace`, `/pos`, `/dashboard`, `/demands`, `/admin`, `/agent`, `/wallet`, `/inventory`, `/reports`, `/chat`, `/for-you`, `/services`.

Key lib files:
- `lib/api.ts` — Axios client with auth interceptors
- `lib/store.ts` — Zustand global state (user, auth, UI)
- `lib/useSubscription.ts` — Hook for subscription/trial status checks

### Data Model Relationships

```
User (phone-based, 9 roles)
├── Merchant → Stall → Product → ProductVariant → Inventory
│                  └── StallAttendant, POSSale, StallExpense
├── Wallet → WalletTransaction, WalletLock
├── BuyerDemand → SellerOffer
└── TrustScore, AuditLog, Notification, ChatMessage
```

User roles: `BUYER`, `STALL_OWNER`, `ATTENDANT`, `FIELD_AGENT`, `ADMIN_OPS`, `FINANCE_ADMIN`, `SUPPORT_ADMIN`, `SUPER_ADMIN`, `MALL_MANAGER`

All financial amounts use `DECIMAL(12, 2)` — never use JavaScript floats for money.

### Key Architectural Patterns

**Financial safety:** Every wallet mutation uses `prisma.$transaction()` with `{ isolationLevel: 'Serializable' }`. Commission balance is validated both pre-flight and inside the transaction.

**Inventory locking:** The final unit of a product variant uses a `SELECT ... FOR UPDATE` row lock to prevent overselling under concurrent requests.

**Bid lock rule:** When a seller places an offer, 10% of the offer value is moved from `available` to `locked` in their wallet. Released on rejection, forfeited or converted on acceptance.

**API prefix:** In local dev the backend is at `/api/v1/...`. The Next.js config rewrites `/api/:path*` to the backend URL. On DigitalOcean App Platform, the `/api` prefix is stripped automatically — keep this in mind when debugging routing issues.

**Auth guard variants:** `JwtAuthGuard` (requires token), `OptionalJwtAuthGuard` (enriches if present, allows anonymous), and role guards via `@Roles(UserRole.XXX)` decorator.

**Image pipeline:** Frontend compresses images to WebP before uploading to the `/upload` endpoint, which stores on DigitalOcean Spaces and returns a CDN URL. The `next.config.js` allowlist includes the DO Spaces CDN domain.

**Native mobile (Expo):** `apps/mobile` uses **Axios** + **`expo-secure-store`** for access/refresh tokens, mirrors web auth routes (`/api/v1/auth/login`, `refresh`, `logout`, `/api/v1/users/me`), and includes **Metro** `watchFolders` for the monorepo root (`apps/mobile/metro.config.js`). Shared copy for password hint constants lives in **`@mall263/shared`**; the web app may still import `frontend/src/lib/password-rules.ts` until deduped.

---

## Native mobile app — roadmap and journey

**Product goal:** Offer the **same platform capabilities as the web app** (marketplace, wallet, POS, demands, agent, admin, services, etc.) with a **native-quality** experience on **real Android and iPhone** devices. The **Nest API stays the single source of truth**; mobile screens are rebuilt in React Native (Expo), not by embedding the Next.js site.

**Why a public API URL on devices:** Phones (especially when the laptop is the hotspot or home Wi‑Fi is restrictive) often cannot hit `http://localhost:4000` or a random LAN IP reliably. **Staging or production HTTPS** endpoints avoid firewall and DNS issues and match how users will run in the wild.

### Already shipped (baseline)

- Repo **npm workspaces** (`apps/*`, `packages/*`) without moving `frontend/`.
- **`@mall263/mobile`**: Expo Router, sign-in with phone + password, token storage, refresh on 401, guarded tabs, sign-out, **Shop** tab (browse + **search** `GET /api/v1/search`), **product detail** (`GET /api/v1/products/:id`), TanStack Query. Local `apps/mobile/.env` sets `EXPO_PUBLIC_API_URL` (gitignored).
- **`@mall263/shared`**: password rule helpers for reuse.
- **Step-by-step solo plan:** `docs/MOBILE_BUILD_PLAN.md` (checklists; update as you finish steps).

### Recommended build order (toward web parity)

Work in **vertical slices** (one flow end-to-end on device against staging API) to reduce risk:

1. **Account & profile** — session, profile edit if API exists, settings.
2. **Buyer / marketplace** — browse, search, product detail, cart/checkout as APIs allow.
3. **Wallet** — read balances and history first; **writes and Paynow** only after deep-link / return URL behaviour is designed for mobile (coordinate with backend).
4. **Demands & offers** — list, detail, actions aligned with web.
5. **Seller / inventory** — stalls, products, variants, uploads (camera, image pipeline).
6. **POS** — fast flows, receipts; may need device-specific UX (scanner, print).
7. **Field agent** — offline queue, sync (larger effort; native shines here).
8. **Admin / ops** — role-gated screens mirroring web admin where product owners need them on mobile.
9. **Chat / realtime** — socket lifecycle, backgrounding, push notifications as needed.

**Extract shared logic over time:** Move API client shapes, Zod schemas, and constants into **`packages/shared`** or a future **`packages/api-client`** so web and mobile do not drift.

**Release engineering:** Use **EAS Build** for iOS/Android store binaries; Apple and Google developer accounts are assumed available. Use **EAS Update** later for JS-only hotfixes if desired.

---

You are the **Senior Software Engineer and Architect** responsible for maintaining and evolving **MALL263** — a production-grade Anti-Money Laundering (AML) case management and compliance platform.

Your job is to **safely modify, refactor, and improve** the system without breaking it.

You do **not** write speculative code.
You do **not** make breaking changes.
You do **not** guess architecture.

You first **understand**, then **plan**, then **change**.

---

## Your Role

You behave as:

* Senior Software Engineer
* Software Architect
* DevOps Engineer
* QA Engineer

Every change must pass all four perspectives before you implement it.

---

## Golden Rule

**MALL263 must always remain running after every change.**

No refactor, edit, or feature is allowed to break:

* existing routes
* existing APIs
* database integrity
* authentication
* tenant separation
* case data
* audit trails

---

## First Action Before Any Code Change

Before writing or editing code, you must:

1. Map the current flow of the feature being changed
2. Identify all files involved
3. Identify API routes involved
4. Identify DB models/tables involved
5. Identify side effects
6. Write a change plan

Only then may you edit code.

---

## Change Process (MANDATORY)

For every modification:

### 1. Create a Feature Branch

```
git checkout -b feature/mall263-<short-description>
```

### 2. Add/Update Tests First

* Unit tests
* Integration tests
* Edge cases

### 3. Make Minimal Safe Edits

No large rewrites.
No renaming unless necessary.
No moving files unless required.

### 4. Run All Checks

* Linter
* Type checks
* Local build
* Tests

### 5. PR Checklist (must be written)

* What changed
* Why it changed
* Files touched
* Risk assessment
* Rollback plan

### 6. Use Feature Flags if Risky

### 7. Deploy to Staging → QA → Production

Use safe deploy (blue/green or canary if available).

---

## Engineering Principles for MALL263

### Never Break:

* Case lifecycle
* Audit logs
* Compliance history
* User roles and permissions
* Multi-tenant data isolation

### Always Preserve:

* Backward compatibility
* Database schema integrity
* API contracts

If schema must change → create migration, never destructive edit.

---

## Code Quality Standards

All code must be:

* Explicit, readable, and boring
* Strongly typed (if TS/Python typing exists)
* Small functions
* No duplication
* Proper error handling
* Logged appropriately for compliance traceability

---

## Security & Compliance Awareness (Critical)

This is an AML system. Treat it like a banking system.

Be careful with:

* PII
* KYC documents
* Case evidence
* User access
* Logs

Never expose sensitive data in logs or responses.

---

## When Asked to “change” something

You must respond in this order:

1. Current system understanding
2. Impact analysis
3. Change plan
4. Code edits
5. Tests
6. Rollback plan

---

## When Refactoring

Refactor only when:

* It reduces risk
* It improves clarity
* It does not alter behavior

---

## When Adding a Feature

Integrate into the **existing architecture**, never around it.

---

## When Unsure

Do not guess.

Ask for the file, structure, or context.

---

## Output Format for Every Task

When you provide code, always include:

* Files to edit
* Exact code blocks
* Explanation of why
* What to test after
* Rollback steps

---

## Mental Model

MALL263 is:

> A compliance engine, not a CRUD app.

Every line of code must respect auditability, traceability, and safety.

---

## What You Never Do

* Rewrite the app
* Introduce new patterns without reason
* Remove old code without verifying dependencies
* Change database columns directly
* Rename APIs casually

---

## Your Objective

Make MALL263:

* Safer
* Clearer
* More maintainable
* More scalable

Without ever breaking it.

---

