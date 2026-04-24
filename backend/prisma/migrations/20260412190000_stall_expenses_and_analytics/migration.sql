-- Expense categories + stall operating expenses + analytics events (store/product views by date)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseCategory') THEN
    CREATE TYPE "ExpenseCategory" AS ENUM (
      'SALARY', 'TRANSPORT', 'MEALS', 'RENT', 'UTILITIES',
      'SUPPLIES', 'MARKETING', 'FEES', 'TAXES', 'OTHER'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StallAnalyticsEventType') THEN
    CREATE TYPE "StallAnalyticsEventType" AS ENUM ('STORE_PAGE_VIEW', 'PRODUCT_DETAIL_VIEW');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "stall_expenses" (
    "id" UUID NOT NULL,
    "stall_id" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stall_expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stall_analytics_events" (
    "id" UUID NOT NULL,
    "stall_id" UUID NOT NULL,
    "type" "StallAnalyticsEventType" NOT NULL,
    "product_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stall_analytics_events_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "stall_expenses" ADD CONSTRAINT "stall_expenses_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "stall_expenses" ADD CONSTRAINT "stall_expenses_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "stall_analytics_events" ADD CONSTRAINT "stall_analytics_events_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "stall_analytics_events" ADD CONSTRAINT "stall_analytics_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "stall_expenses_stall_id_occurred_at_idx" ON "stall_expenses"("stall_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "stall_expenses_category_idx" ON "stall_expenses"("category");

CREATE INDEX IF NOT EXISTS "stall_analytics_events_stall_id_created_at_idx" ON "stall_analytics_events"("stall_id", "created_at");
CREATE INDEX IF NOT EXISTS "stall_analytics_events_stall_id_type_created_at_idx" ON "stall_analytics_events"("stall_id", "type", "created_at");
CREATE INDEX IF NOT EXISTS "stall_analytics_events_product_id_idx" ON "stall_analytics_events"("product_id");
