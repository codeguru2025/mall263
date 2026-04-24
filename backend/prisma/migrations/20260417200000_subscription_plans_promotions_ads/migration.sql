-- ============================================================
-- SUBSCRIPTION PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"        TEXT         NOT NULL,
    "slug"        TEXT         NOT NULL,
    "price_usd"   DECIMAL(10,2) NOT NULL,
    "trial_days"  INTEGER      NOT NULL DEFAULT 7,
    "description" TEXT,
    "features"    JSONB        NOT NULL DEFAULT '[]',
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "is_default"  BOOLEAN      NOT NULL DEFAULT false,
    "sort_order"  INTEGER      NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_slug_key"       ON "subscription_plans"("slug");
CREATE INDEX IF NOT EXISTS        "subscription_plans_is_active_idx"  ON "subscription_plans"("is_active");
CREATE INDEX IF NOT EXISTS        "subscription_plans_is_default_idx" ON "subscription_plans"("is_default");

-- Seed the default plan (explicit id for DBs where column default was not applied)
INSERT INTO "subscription_plans"
    ("id", "name", "slug", "price_usd", "trial_days", "description", "features", "is_active", "is_default", "sort_order", "created_at", "updated_at")
VALUES (
    gen_random_uuid(),
    'Standard',
    'standard',
    5.00,
    7,
    'Full access to all Mall263 seller features',
    '["Full POS & sales management","Inventory tracking & reports","Customer chat & demand alerts","Buyer demand notifications","Product listings & variants","Agent & stall management"]'::jsonb,
    true,
    true,
    0,
    NOW(),
    NOW()
)
ON CONFLICT ("slug") DO NOTHING;

-- ============================================================
-- PROMOTIONS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromoType') THEN
    CREATE TYPE "PromoType" AS ENUM ('REFERRAL', 'COUPON', 'DISCOUNT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "promotions" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"            TEXT         NOT NULL,
    "type"            "PromoType"  NOT NULL,
    "discount_pct"    DECIMAL(5,2),
    "discount_amt"    DECIMAL(10,2),
    "max_uses"        INTEGER,
    "used_count"      INTEGER      NOT NULL DEFAULT 0,
    "valid_from"      TIMESTAMP(3) NOT NULL,
    "valid_until"     TIMESTAMP(3),
    "is_active"       BOOLEAN      NOT NULL DEFAULT true,
    "description"     TEXT,
    "created_by_id"   UUID         NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promotions_code_key"      ON "promotions"("code");
CREATE INDEX IF NOT EXISTS        "promotions_code_idx"      ON "promotions"("code");
CREATE INDEX IF NOT EXISTS        "promotions_is_active_idx" ON "promotions"("is_active");

-- ============================================================
-- ADS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdPlacement') THEN
    CREATE TYPE "AdPlacement" AS ENUM ('BANNER_TOP', 'BANNER_BOTTOM', 'SIDEBAR', 'INTERSTITIAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ads" (
    "id"              UUID           NOT NULL DEFAULT gen_random_uuid(),
    "title"           TEXT           NOT NULL,
    "image_url"       TEXT,
    "link_url"        TEXT,
    "placement"       "AdPlacement"  NOT NULL,
    "target_role"     TEXT,
    "is_active"       BOOLEAN        NOT NULL DEFAULT true,
    "starts_at"       TIMESTAMP(3)   NOT NULL,
    "ends_at"         TIMESTAMP(3),
    "impressions"     INTEGER        NOT NULL DEFAULT 0,
    "created_by_id"   UUID           NOT NULL,
    "created_at"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ads_is_active_idx" ON "ads"("is_active");
CREATE INDEX IF NOT EXISTS "ads_placement_idx" ON "ads"("placement");
