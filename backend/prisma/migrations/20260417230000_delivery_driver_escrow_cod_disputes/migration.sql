-- ============================================================
-- Migration: delivery_driver_escrow_cod_disputes
-- Adds the full delivery network, SafePay escrow, COD system,
-- driver trust tiers, float wallet, and dispute resolution.
-- ============================================================

-- 1. New enum values in existing enums

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DRIVER';

ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'ESCROW_LOCK';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'ESCROW_RELEASE';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'ESCROW_REFUND';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'DELIVERY_FEE';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'DRIVER_EARNING';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'RISK_RESERVE';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'COD_COLLECTED';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'COD_REMITTED';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'FLOAT_HOLD';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'FLOAT_RELEASE';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_BROADCAST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_PICKUP_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_DELIVERED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COD_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_OPENED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_RESOLVED';

-- 2. New enums

CREATE TYPE "DriverTier" AS ENUM ('ONBOARDING', 'TRUSTED', 'ELITE');
CREATE TYPE "DeliveryMode" AS ENUM ('SAFE_PAY', 'CASH_ON_DELIVERY', 'DIRECT_DEAL');
CREATE TYPE "DeliveryJobStatus" AS ENUM (
  'BROADCAST',
  'ACCEPTED',
  'PICKUP_CONFIRMED',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'RETURNED'
);
CREATE TYPE "EscrowStatus" AS ENUM (
  'HELD',
  'RELEASED_TO_SELLER',
  'REFUNDED_TO_BUYER',
  'IN_DISPUTE'
);
CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED_SELLER',
  'RESOLVED_BUYER',
  'RESOLVED_RESERVE'
);
CREATE TYPE "CODRemittanceStatus" AS ENUM ('PENDING', 'REMITTED', 'OVERDUE');

-- 3. drivers table

CREATE TABLE "drivers" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"         UUID         NOT NULL,
  "tier"            "DriverTier" NOT NULL DEFAULT 'ONBOARDING',
  "is_active"       BOOLEAN      NOT NULL DEFAULT true,
  "kyc_verified"    BOOLEAN      NOT NULL DEFAULT false,
  "kyc_doc_url"     TEXT,
  "vehicle_type"    TEXT,
  "current_lat"     DECIMAL(10,8),
  "current_lng"     DECIMAL(11,8),
  "location_at"     TIMESTAMP(3),
  "completed_jobs"  INTEGER      NOT NULL DEFAULT 0,
  "total_earnings"  DECIMAL(14,2) NOT NULL DEFAULT 0,
  "float_balance"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cod_cash_held"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  "max_cod_exposure" DECIMAL(14,2) NOT NULL DEFAULT 50,
  "rating"          DECIMAL(5,2) NOT NULL DEFAULT 50,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "drivers_user_id_key" ON "drivers"("user_id");
CREATE INDEX "drivers_is_active_tier_idx" ON "drivers"("is_active", "tier");
CREATE INDEX "drivers_current_lat_current_lng_idx" ON "drivers"("current_lat", "current_lng");

ALTER TABLE "drivers"
  ADD CONSTRAINT "drivers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- 4. delivery_jobs table

CREATE TABLE "delivery_jobs" (
  "id"                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "order_id"             UUID                 NOT NULL,
  "order_type"           TEXT                 NOT NULL,
  "seller_id"            UUID                 NOT NULL,
  "buyer_id"             UUID                 NOT NULL,
  "driver_id"            UUID,
  "mode"                 "DeliveryMode"       NOT NULL,
  "status"               "DeliveryJobStatus"  NOT NULL DEFAULT 'BROADCAST',
  "pickup_zone"          TEXT                 NOT NULL,
  "drop_zone"            TEXT                 NOT NULL,
  "pickup_address"       TEXT,
  "drop_address"         TEXT,
  "pickup_lat"           DECIMAL(10,8),
  "pickup_lng"           DECIMAL(11,8),
  "drop_lat"             DECIMAL(10,8),
  "drop_lng"             DECIMAL(11,8),
  "distance_km"          DECIMAL(8,2),
  "item_amount"          DECIMAL(14,2)        NOT NULL,
  "delivery_fee"         DECIMAL(14,2)        NOT NULL,
  "platform_fee"         DECIMAL(14,2)        NOT NULL,
  "reserve_amount"       DECIMAL(14,2)        NOT NULL,
  "driver_earning"       DECIMAL(14,2)        NOT NULL,
  "pickup_photo_url"     TEXT,
  "pickup_timestamp"     TIMESTAMP(3),
  "pickup_gps_lat"       DECIMAL(10,8),
  "pickup_gps_lng"       DECIMAL(11,8),
  "delivery_photo_url"   TEXT,
  "delivery_timestamp"   TIMESTAMP(3),
  "delivery_gps_lat"     DECIMAL(10,8),
  "delivery_gps_lng"     DECIMAL(11,8),
  "broadcasted_at"       TIMESTAMP(3),
  "accepted_at"          TIMESTAMP(3),
  "completed_at"         TIMESTAMP(3),
  "cancel_reason"        TEXT,
  "created_at"           TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3)         NOT NULL,

  CONSTRAINT "delivery_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_jobs_status_idx"      ON "delivery_jobs"("status");
CREATE INDEX "delivery_jobs_seller_id_idx"   ON "delivery_jobs"("seller_id");
CREATE INDEX "delivery_jobs_buyer_id_idx"    ON "delivery_jobs"("buyer_id");
CREATE INDEX "delivery_jobs_driver_id_idx"   ON "delivery_jobs"("driver_id");
CREATE INDEX "delivery_jobs_mode_status_idx" ON "delivery_jobs"("mode", "status");

ALTER TABLE "delivery_jobs"
  ADD CONSTRAINT "delivery_jobs_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "delivery_jobs"
  ADD CONSTRAINT "delivery_jobs_buyer_id_fkey"
  FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "delivery_jobs"
  ADD CONSTRAINT "delivery_jobs_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL;

-- 5. escrow_accounts table

CREATE TABLE "escrow_accounts" (
  "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
  "job_id"       UUID          NOT NULL,
  "buyer_id"     UUID          NOT NULL,
  "total_held"   DECIMAL(14,2) NOT NULL,
  "item_amount"  DECIMAL(14,2) NOT NULL,
  "delivery_fee" DECIMAL(14,2) NOT NULL,
  "platform_fee" DECIMAL(14,2) NOT NULL,
  "reserve_amt"  DECIMAL(14,2) NOT NULL,
  "status"       "EscrowStatus" NOT NULL DEFAULT 'HELD',
  "released_at"  TIMESTAMP(3),
  "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "escrow_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "escrow_accounts_job_id_key" ON "escrow_accounts"("job_id");
CREATE INDEX "escrow_accounts_buyer_id_status_idx" ON "escrow_accounts"("buyer_id", "status");

ALTER TABLE "escrow_accounts"
  ADD CONSTRAINT "escrow_accounts_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE RESTRICT;

ALTER TABLE "escrow_accounts"
  ADD CONSTRAINT "escrow_accounts_buyer_id_fkey"
  FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT;

-- 6. cod_transactions table

CREATE TABLE "cod_transactions" (
  "id"                UUID                  NOT NULL DEFAULT gen_random_uuid(),
  "job_id"            UUID                  NOT NULL,
  "driver_id"         UUID                  NOT NULL,
  "cash_amount"       DECIMAL(14,2)         NOT NULL,
  "remittance_status" "CODRemittanceStatus" NOT NULL DEFAULT 'PENDING',
  "remitted_amount"   DECIMAL(14,2)         NOT NULL DEFAULT 0,
  "remitted_at"       TIMESTAMP(3),
  "remittance_ref"    TEXT,
  "created_at"        TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3)          NOT NULL,

  CONSTRAINT "cod_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cod_transactions_job_id_key" ON "cod_transactions"("job_id");
CREATE INDEX "cod_transactions_driver_id_remittance_status_idx"
  ON "cod_transactions"("driver_id", "remittance_status");

ALTER TABLE "cod_transactions"
  ADD CONSTRAINT "cod_transactions_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE RESTRICT;

ALTER TABLE "cod_transactions"
  ADD CONSTRAINT "cod_transactions_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT;

-- 7. driver_float_transactions table

CREATE TABLE "driver_float_transactions" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "driver_id"   UUID         NOT NULL,
  "amount"      DECIMAL(14,2) NOT NULL,
  "type"        TEXT         NOT NULL,
  "reference"   TEXT,
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "driver_float_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "driver_float_transactions_driver_id_idx"
  ON "driver_float_transactions"("driver_id");

ALTER TABLE "driver_float_transactions"
  ADD CONSTRAINT "driver_float_transactions_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT;

-- 8. disputes table

CREATE TABLE "disputes" (
  "id"             UUID           NOT NULL DEFAULT gen_random_uuid(),
  "job_id"         UUID           NOT NULL,
  "raised_by_id"   UUID           NOT NULL,
  "reason"         TEXT           NOT NULL,
  "evidence"       JSONB,
  "status"         "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "resolution"     TEXT,
  "resolved_by_id" UUID,
  "resolved_at"    TIMESTAMP(3),
  "created_at"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3)   NOT NULL,

  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "disputes_job_id_key"        ON "disputes"("job_id");
CREATE INDEX "disputes_status_idx"               ON "disputes"("status");
CREATE INDEX "disputes_raised_by_id_idx"         ON "disputes"("raised_by_id");

ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE RESTRICT;

ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_raised_by_id_fkey"
  FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- 9. risk_reserve_pool table

CREATE TABLE "risk_reserve_pool" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "balance"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_in"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_out"  DECIMAL(14,2) NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "risk_reserve_pool_pkey" PRIMARY KEY ("id")
);

-- Seed the single risk reserve pool row
INSERT INTO "risk_reserve_pool" ("id", "balance", "total_in", "total_out", "updated_at")
VALUES (gen_random_uuid(), 0, 0, 0, NOW())
ON CONFLICT DO NOTHING;
