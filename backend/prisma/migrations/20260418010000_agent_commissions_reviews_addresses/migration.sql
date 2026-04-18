-- Add AGENT_COMMISSION to WalletTransactionType enum
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'AGENT_COMMISSION';

-- Add AGENT_COMMISSION_CREDITED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGENT_COMMISSION_CREDITED';

-- Add AgentCommissionStatus enum
DO $$ BEGIN
  CREATE TYPE "AgentCommissionStatus" AS ENUM ('PENDING', 'CREDITED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable AgentCommission
CREATE TABLE IF NOT EXISTS "agent_commissions" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id"        UUID NOT NULL,
    "merchant_id"     UUID NOT NULL,
    "subscription_id" UUID,
    "amount"          DECIMAL(10,2) NOT NULL,
    "currency"        TEXT NOT NULL DEFAULT 'USD',
    "status"          "AgentCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at"         TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_commissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_commissions_agent_id_idx" ON "agent_commissions"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_commissions_merchant_id_idx" ON "agent_commissions"("merchant_id");
CREATE INDEX IF NOT EXISTS "agent_commissions_status_idx" ON "agent_commissions"("status");

ALTER TABLE "agent_commissions"
    ADD CONSTRAINT "agent_commissions_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_commissions"
    ADD CONSTRAINT "agent_commissions_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable ProductReview
CREATE TABLE IF NOT EXISTS "product_reviews" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id"  UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "rating"      INTEGER NOT NULL,
    "title"       TEXT,
    "body"        TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_reviews_product_id_reviewer_id_key" UNIQUE ("product_id", "reviewer_id")
);

CREATE INDEX IF NOT EXISTS "product_reviews_product_id_idx" ON "product_reviews"("product_id");
CREATE INDEX IF NOT EXISTS "product_reviews_reviewer_id_idx" ON "product_reviews"("reviewer_id");
CREATE INDEX IF NOT EXISTS "product_reviews_rating_idx" ON "product_reviews"("rating");

ALTER TABLE "product_reviews"
    ADD CONSTRAINT "product_reviews_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_reviews"
    ADD CONSTRAINT "product_reviews_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable UserAddress
CREATE TABLE IF NOT EXISTS "user_addresses" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID NOT NULL,
    "label"      TEXT NOT NULL,
    "line_1"     TEXT NOT NULL,
    "line_2"     TEXT,
    "city"       TEXT NOT NULL,
    "country"    TEXT NOT NULL DEFAULT 'ZW',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_addresses_user_id_idx" ON "user_addresses"("user_id");

ALTER TABLE "user_addresses"
    ADD CONSTRAINT "user_addresses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
