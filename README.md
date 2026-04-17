# Mall263

Zimbabwe's digital marketplace and POS platform for flea markets and informal retail.

## Architecture

- **Backend**: NestJS + Prisma + PostgreSQL + Redis + Meilisearch
- **Frontend**: Next.js 14 (App Router) + TailwindCSS + React Query + Zustand
- **Mobile**: Expo (React Native) in `apps/mobile` — same Nest API as the web app (`packages/shared` for small shared helpers)
- **Deployment**: Docker Compose

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for infrastructure)

### Option 1: Docker Compose (recommended)

```bash
docker-compose up -d
```

This starts PostgreSQL, Redis, Meilisearch, backend (port 3001), and frontend (port 3000).

### Option 2: Local Development

```bash
# Start infrastructure
docker-compose up -d postgres redis meilisearch

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Mobile app (Expo, optional)

From the **repository root** (installs the `apps/mobile` workspace and `@mall263/shared`):

```bash
npm install
npm run dev:mobile
```

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_URL` (use your machine’s LAN IP for a physical device). Details: `apps/mobile/README.md`.

**Solo build checklist (order of work):** `docs/MOBILE_BUILD_PLAN.md`

### Access

| Service       | URL                        |
|---------------|----------------------------|
| Frontend      | http://localhost:3000       |
| Backend API   | http://localhost:3001       |
| Swagger Docs  | http://localhost:3001/docs  |
| Meilisearch   | http://localhost:7700       |

### Test Accounts (after seeding)

| Role       | Phone           | Password      |
|------------|-----------------|---------------|
| Admin      | +263770000001   | admin123456   |
| Merchant   | +263771000001   | merchant123   |
| Buyer      | +263772000001   | buyer12345    |
| Agent      | +263773000001   | agent12345    |

## Project Structure

```
mall263/
├── backend/
│   ├── prisma/           # Schema + migrations + seed
│   └── src/
│       ├── common/       # Guards, decorators
│       ├── modules/      # Feature modules
│       │   ├── auth/     # JWT authentication
│       │   ├── users/    # User management
│       │   ├── merchants/# Merchant onboarding
│       │   ├── stalls/   # Stall management
│       │   ├── products/ # Product catalog
│       │   ├── inventory/# Stock management
│       │   ├── wallet/   # Wallet + commissions
│       │   ├── pos/      # Point of Sale
│       │   ├── demands/  # Buyer demand board
│       │   ├── search/   # Meilisearch integration
│       │   ├── agents/   # Field agent tasks
│       │   ├── trust/    # Trust scoring
│       │   ├── audit/    # Audit logging
│       │   ├── notifications/
│       │   ├── admin/    # Admin dashboard
│       │   ├── reports/  # Sales & platform reports
│       │   └── health/   # Health check
│       ├── prisma/       # Prisma service
│       └── redis/        # Redis service
├── frontend/
│   └── src/
│       ├── app/          # Next.js App Router pages
│       │   ├── auth/     # Login, Register
│       │   ├── marketplace/
│       │   ├── demands/
│       │   ├── pos/
│       │   ├── dashboard/
│       │   └── admin/
│       └── lib/          # API client, stores, utils
└── docker-compose.yml
```

## Key Features

- **POS System**: Process sales, auto-deduct inventory, 2.5% commission
- **Wallet System**: Deposits, locks, commission deductions, full transaction history
- **Demand Engine**: Buyers post demands, sellers submit offers, 10% wallet lock rule
- **Search**: Meilisearch with database fallback
- **Trust & Fraud**: Trust scoring based on transactions, fraud anomaly detection
- **Role-Based Access**: SUPER_ADMIN, ADMIN_OPS, FINANCE_ADMIN, STALL_OWNER, ATTENDANT, BUYER, FIELD_AGENT
- **Field Agents**: Task management, offline sync, onboarding processing
- **Audit Trail**: Full event logging for compliance
- **Reports**: Stall-level and platform-level sales/commission reports

## Environment Variables

See `backend/.env.example` for all required environment variables.

## License

Proprietary - Mall263 (Pvt) Ltd
