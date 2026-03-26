# Mall263 — Production Architecture Document

## 1. Executive Summary

Mall263 is a hybrid commerce platform designed for African informal retail: flea markets, malls, and stall-based environments. It combines a **POS + inventory system** (the retention engine) with a **demand-driven marketplace** (the acquisition engine), unified by a **wallet-controlled transaction layer** that enforces buyer seriousness and seller discipline.

**Strategic thesis:** Sellers join for customers. Sellers stay because the POS becomes essential to their daily operations. Buyers get a discovery engine they can't replicate offline.

**Revenue model:**
- Monthly POS subscription per stall ($5-15/month tiered)
- 2.5% commission per marketplace sale (pre-funded by seller)
- Premium placement fees (Phase 2+)

**Target market:** Zimbabwe first, then expand to regional African markets.

---

## 2. Product Description

### What Mall263 IS:
- **The operating system for stall owners** — POS, inventory, sales reports, profit tracking
- **The discovery engine for buyers** — search, browse, demand posting, offer comparison
- **The transaction layer for both** — wallets, commission enforcement, locked funds, trust scores

### What Mall263 is NOT:
- Not a general e-commerce platform (it's stall-centric)
- Not a payment processor (it's a wallet + ledger system that integrates with local payment rails)
- Not a logistics company (transactions happen in-person at stalls)

---

## 3. Core Workflows

### 3.1 Field Agent Onboarding Flow
```
Agent visits market → Registers merchant → Captures stall details →
Photographs products → Enters variants/pricing → Products go live →
Agent earns onboarding credit
```

### 3.2 Buyer Discovery Flow
```
Browse freely (FREE MODE) → See products with limited seller info →
Fund wallet (FUNDED MODE) → Unlock seller details →
Hold 10% of target value (ACTIVE BUYER) → Place bids / lock offers
```

### 3.3 Demand-Driven Flow
```
Buyer posts demand ("Looking for size 8 Nike Air Max, budget $80") →
Matching sellers receive alert → Sellers compete with offers →
Buyer compares, accepts best → Transaction proceeds
```

### 3.4 POS Sale Flow
```
Attendant searches product → Selects variant → Adds to cart →
Applies discount (optional) → Checks seller commission balance →
Processes sale → Auto-deducts commission → Updates inventory →
Generates receipt → Alerts on low stock
```

### 3.5 Wallet Flow
```
User deposits via EcoCash/InnBucks/bank → Wallet credited →
Funds available for: bids (locked), purchases (transferred),
commission reserve (seller) → All movements logged in ledger
```

---

## 4. Feature Architecture

### User Types & Permissions

| Role | Capabilities |
|------|-------------|
| Buyer | Browse, search, fund wallet, post demands, bid, purchase |
| Stall Owner | Manage products, view POS, manage attendants, view reports |
| Attendant/Cashier | Process POS sales, view inventory, issue receipts |
| Field Agent | Onboard merchants, capture products, offline sync |
| Admin (Ops) | View all stalls, manage disputes, moderate listings |
| Finance Admin | Manage wallets, process withdrawals, view ledger |
| Support Admin | Handle tickets, manage refunds |
| Super Admin | Full system access, role management |
| Mall Manager | View mall-level analytics, manage mall stalls |

### Buying Power System (3-Tier)

1. **FREE MODE** (wallet = 0): Browse products, limited seller visibility (no name, contact, exact location)
2. **FUNDED MODE** (wallet > 0): Full seller details, participate in offers
3. **ACTIVE BUYER MODE** (wallet ≥ 10% of target): Place serious bids, lock offers

---

## 5. Database Design

### Entity Relationship Summary

```
users ─── roles (many-to-many via user_roles)
users ─── merchants (one-to-one for stall owners)
merchants ─── stalls (one-to-many)
stalls ─── products (one-to-many)
products ─── product_variants (one-to-many)
product_variants ─── inventory (one-to-one)
users ─── wallets (one-to-one)
wallets ─── wallet_transactions (one-to-many)
wallets ─── wallet_locks (one-to-many)
users ─── buyer_demands (one-to-many)
buyer_demands ─── seller_offers (one-to-many)
stalls ─── pos_sales (one-to-many)
pos_sales ─── pos_sale_items (one-to-many)
pos_sales ─── receipts (one-to-one)
users ─── trust_scores (one-to-one)
users ─── audit_logs (one-to-many)
users ─── notifications (one-to-many)
```

See `backend/prisma/schema.prisma` for full schema.

---

## 6. API Design

### Route Structure

```
/api/v1/auth/*           — Authentication & registration
/api/v1/users/*          — User management
/api/v1/merchants/*      — Merchant management
/api/v1/stalls/*         — Stall CRUD
/api/v1/products/*       — Product catalog
/api/v1/inventory/*      — Inventory management
/api/v1/wallets/*        — Wallet operations
/api/v1/pos/*            — POS operations
/api/v1/demands/*        — Buyer demand posts
/api/v1/offers/*         — Seller offer responses
/api/v1/search/*         — Search engine
/api/v1/agents/*         — Field agent operations
/api/v1/admin/*          — Admin operations
/api/v1/notifications/*  — Notification management
/api/v1/reports/*        — Reporting & analytics
```

---

## 7. Tech Stack

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 10 (modular, TypeScript, dependency injection)
- **ORM:** Prisma 5 (type-safe, migrations, PostgreSQL)
- **Auth:** Passport.js + JWT + bcrypt
- **Validation:** class-validator + class-transformer
- **Queue:** BullMQ + Redis (background jobs: notifications, sync, analytics)
- **WebSocket:** Socket.io via @nestjs/websockets
- **Search:** Meilisearch (typo-tolerant, fast, easy to self-host)
- **Cache:** Redis (sessions, rate limiting, hot data)
- **Storage:** S3-compatible (DigitalOcean Spaces)
- **Email:** Nodemailer + templates
- **SMS:** Africa's Talking API (Zimbabwe support)

### Frontend
- **Framework:** Next.js 14 (App Router, SSR, mobile-first)
- **UI:** Tailwind CSS + shadcn/ui + Lucide icons
- **State:** Zustand (lightweight, no boilerplate)
- **Forms:** React Hook Form + Zod validation
- **Data fetching:** TanStack Query (React Query)
- **PWA:** next-pwa (offline support critical for Africa)
- **Charts:** Recharts (POS reports)

### Infrastructure
- **Database:** PostgreSQL 16 (DigitalOcean Managed)
- **Search:** Meilisearch (self-hosted on droplet)
- **Cache/Queue:** Redis (DigitalOcean Managed)
- **Storage:** DigitalOcean Spaces + CDN
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry + custom health checks

---

## 8. Wallet + Commission Engine

### Wallet Architecture
Every user gets exactly one wallet. Wallets use a **double-entry ledger** system.

**Wallet States:**
- `available_balance` — funds free to use
- `locked_balance` — funds locked for pending bids/offers
- `total_balance` = available + locked

**Transaction Types:**
- DEPOSIT, WITHDRAWAL, TRANSFER, COMMISSION_DEDUCTION, COMMISSION_RESERVE
- BID_LOCK, BID_UNLOCK, BID_FORFEIT, REFUND, FEE

**Commission Reserve Rule:**
Before any POS sale, system checks: `seller.wallet.available_balance >= sale_total * 0.025`
If insufficient → sale is BLOCKED with clear message to fund wallet.

**Bid Lock Rule:**
Buyer must have ≥10% of bid value available. System locks that amount.
On bid acceptance → locked funds transfer. On rejection → funds unlock.

---

## 9. POS + Inventory System

### POS Features
- Quick product search (by name, SKU, barcode)
- Variant selection (size, color)
- Cart management with quantity adjustment
- Discount application (percentage or fixed)
- Commission check before sale completion
- Auto inventory deduction on sale
- Receipt generation (digital + printable)
- Returns and refunds with inventory restoration
- Daily/weekly/monthly sales reports
- Profit tracking (cost vs. selling price)
- Low stock alerts (configurable threshold)

### Inventory Management
- Real-time stock tracking per variant
- Stock adjustment logs (audit trail)
- Bulk import/update
- Reserved stock (for locked offers)
- Automatic reorder alerts

### Race Condition Protection (Last Item)
Uses PostgreSQL row-level locking:
```sql
SELECT * FROM inventory WHERE variant_id = $1 FOR UPDATE;
-- Check quantity >= requested
-- Deduct quantity
-- COMMIT
```

---

## 10. Search + Bidding Engine

### Meilisearch Configuration
- **Searchable attributes:** name, description, category, tags, color, size, brand
- **Filterable attributes:** category, price_range, stall_id, mall_id, in_stock, trust_score
- **Sortable attributes:** price, trust_score, created_at, relevance
- **Typo tolerance:** enabled (max 2 typos)
- **Synonyms:** configured per category (e.g., "sneakers" = "trainers" = "kicks")

### Ranking Rules
1. Words (exact match)
2. Typo tolerance
3. Proximity
4. Attribute priority
5. Sort (user-selected)
6. Trust score boost
7. Stock availability boost

### Market Price Engine
Calculates average price per product category+attributes across all stalls.
Displayed as "Market average: $X" alongside each listing.

---

## 11. Security + Fraud System

### Protections
- **Fake buyers:** Wallet funding requirement, phone verification, trust score
- **Fake sellers:** Field agent verification, commission pre-funding, fulfillment tracking
- **Wallet abuse:** Transaction velocity limits, deposit source verification
- **Refund abuse:** Refund frequency caps, pattern detection, manual review triggers
- **Stock manipulation:** Audit logs on all inventory changes, anomaly detection
- **Price manipulation:** Price change frequency limits, price history tracking

### Audit System
Every state-changing operation logs:
- who, what, when, from_value, to_value, ip_address, user_agent

---

## 12. DigitalOcean Deployment Design

### Services
1. **Web Service** (backend API) — App Platform, 2 instances min
2. **Web Service** (frontend) — App Platform, 2 instances min
3. **Worker Service** — App Platform, 1 instance (BullMQ processor)
4. **Database** — Managed PostgreSQL (2 vCPU, 4GB RAM to start)
5. **Redis** — Managed Redis (1GB to start)
6. **Meilisearch** — Droplet (2 vCPU, 4GB RAM)
7. **Storage** — Spaces bucket + CDN

### Scaling Rules
- API: scale on CPU > 70% or memory > 80%
- Worker: scale on queue depth > 1000
- Database: read replicas when query latency > 100ms

---

## 13. Implementation Roadmap

### Phase 1 (Weeks 1-3): Foundation
- Auth system, user roles, JWT
- Merchant + stall CRUD
- Field agent onboarding flow
- Basic admin panel

### Phase 2 (Weeks 4-6): Catalog + Search
- Product + variant management
- Image upload pipeline
- Meilisearch integration
- Buyer browse experience

### Phase 3 (Weeks 7-9): Commerce Engine
- Wallet system (deposit, balance, ledger)
- Commission engine
- Buying power tiers
- Demand + bidding system

### Phase 4 (Weeks 10-12): POS
- POS interface
- Cart + checkout
- Inventory management
- Receipts + reports

### Phase 5 (Weeks 13-15): Trust + Scale
- Trust scoring
- Fraud detection
- Analytics dashboard
- Performance optimization

### Phase 6 (Weeks 16+): Growth
- PWA offline mode
- SMS notifications
- Mall manager portal
- API rate limiting + abuse prevention

---

## 14. Risks + Improvements

### Biggest Risks
1. **Adoption:** Stall owners may resist digitization → mitigate with field agents + free onboarding
2. **Connectivity:** Poor internet in markets → PWA offline mode, queue-based sync
3. **Trust:** Cash-dominant culture → start with small wallet amounts, build gradually
4. **Commission resistance:** 2.5% feels high → offer first 30 days free, show ROI via reports
5. **Agent quality:** Bad product data → validation rules + image quality checks

### Proactive Improvements
1. **USSD fallback** for feature phones (Phase 3+)
2. **WhatsApp integration** for notifications (high open rates in Africa)
3. **Layby/installment** support for high-value items
4. **Multi-currency** support (USD + ZWL + bond notes)
5. **Referral system** — buyers refer buyers, sellers refer sellers

---

## 15. Go-to-Market Strategy: Zimbabwe

### Launch Markets
1. **Mbare Musika** (Harare) — largest flea market, high volume
2. **Gulf Complex** (Harare) — electronics + clothing
3. **Eastgate Mall** (Harare) — formal mall for credibility
4. **Bulawayo City Centre** — second city expansion

### Tactics
- Deploy 10 field agents per market
- Target 100 stalls in first month
- Offer 90-day free POS subscription
- Partner with EcoCash for wallet funding (90%+ mobile money penetration)
- WhatsApp group per market for support
- Weekly "top seller" recognition to drive engagement

### Unit Economics Target
- 1000 active stalls × $10/month subscription = $10,000 MRR
- 1000 stalls × $500 avg monthly GMV × 2.5% = $12,500 commission
- Target: $22,500 MRR by month 6
