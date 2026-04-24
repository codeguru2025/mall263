-- CreateEnum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trial_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trial_ends_at" TIMESTAMP(3) NOT NULL,
    "ecocash_number" TEXT,
    "current_period_end" TIMESTAMP(3),
    "next_billing_date" TIMESTAMP(3),
    "last_billed_at" TIMESTAMP(3),
    "last_payment_ref" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "subscription_payments" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paynow_ref" TEXT,
    "poll_url" TEXT,
    "status" TEXT NOT NULL,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_id_key" ON "subscriptions"("user_id");

CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");

CREATE INDEX IF NOT EXISTS "subscriptions_next_billing_date_idx" ON "subscriptions"("next_billing_date");

CREATE INDEX IF NOT EXISTS "subscriptions_next_retry_at_idx" ON "subscriptions"("next_retry_at");

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_paynow_ref_key" ON "subscription_payments"("paynow_ref");

CREATE INDEX IF NOT EXISTS "subscription_payments_subscription_id_idx" ON "subscription_payments"("subscription_id");

CREATE INDEX IF NOT EXISTS "subscription_payments_status_idx" ON "subscription_payments"("status");

CREATE INDEX IF NOT EXISTS "subscription_payments_paynow_ref_idx" ON "subscription_payments"("paynow_ref");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
