-- Migration: add_cities_vsw_shop_settings (idempotent for drifted DBs)

-- ── 1. ShelfLayer enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShelfLayer') THEN
    CREATE TYPE "ShelfLayer" AS ENUM ('MIDDLE', 'TOP', 'BOTTOM');
  END IF;
END $$;

-- ── 2. Cities table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cities" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"       TEXT        NOT NULL,
    "country"    TEXT        NOT NULL DEFAULT 'ZW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "cities_name_key" ON "cities"("name");
CREATE INDEX IF NOT EXISTS "cities_country_idx" ON "cities"("country");

-- ── 3. Migrate malls.city TEXT → city_id (only if legacy "city" column still exists) ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'malls' AND column_name = 'city'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'malls' AND column_name = 'city_id'
    ) THEN
      ALTER TABLE "malls" ADD COLUMN "city_id" UUID;
    END IF;

    INSERT INTO "cities" ("name")
    SELECT DISTINCT TRIM("city") FROM "malls" WHERE TRIM("city") <> ''
    ON CONFLICT ("name") DO NOTHING;

    UPDATE "malls" m
    SET "city_id" = c."id"
    FROM "cities" c
    WHERE LOWER(TRIM(m."city")) = LOWER(TRIM(c."name"));

    INSERT INTO "cities" ("name") VALUES ('Unknown') ON CONFLICT ("name") DO NOTHING;
    UPDATE "malls" SET "city_id" = (SELECT "id" FROM "cities" WHERE "name" = 'Unknown' LIMIT 1)
    WHERE "city_id" IS NULL;

    ALTER TABLE "malls" ALTER COLUMN "city_id" SET NOT NULL;

    DROP INDEX IF EXISTS "malls_city_idx";
    ALTER TABLE "malls" DROP COLUMN "city";
  END IF;
END $$;

-- 3f–3g: FK and indexes on malls (safe if already present)
DO $$ BEGIN
  ALTER TABLE "malls" ADD CONSTRAINT "malls_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "malls" ADD CONSTRAINT "malls_city_id_name_key" UNIQUE ("city_id", "name");
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "malls_city_id_idx" ON "malls"("city_id");

-- ── 4. Shop settings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "shop_settings" (
    "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    "stall_id"            UUID        NOT NULL,
    "show_on_marketplace" BOOLEAN     NOT NULL DEFAULT true,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_settings_stall_id_key" ON "shop_settings"("stall_id");
DO $$ BEGIN
  ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. Virtual walk videos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "shop_virtual_walk_videos" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "shop_id"       UUID         NOT NULL,
    "aisle_name"    TEXT         NOT NULL,
    "shelf_layer"   "ShelfLayer" NOT NULL,
    "video_url"     TEXT         NOT NULL,
    "thumbnail_url" TEXT,
    "duration"      INTEGER,
    "file_size"     INTEGER,
    "is_active"     BOOLEAN      NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_virtual_walk_videos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shop_virtual_walk_videos_shop_id_idx"   ON "shop_virtual_walk_videos"("shop_id");
CREATE INDEX IF NOT EXISTS "shop_virtual_walk_videos_is_active_idx" ON "shop_virtual_walk_videos"("is_active");
DO $$ BEGIN
  ALTER TABLE "shop_virtual_walk_videos" ADD CONSTRAINT "shop_virtual_walk_videos_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "stalls"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Video hotspots ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "video_hotspots" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "video_id"   UUID         NOT NULL,
    "timestamp"  DOUBLE PRECISION NOT NULL,
    "x_coord"    DOUBLE PRECISION NOT NULL,
    "y_coord"    DOUBLE PRECISION NOT NULL,
    "product_id" UUID         NOT NULL,
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_hotspots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "video_hotspots_video_id_idx"   ON "video_hotspots"("video_id");
CREATE INDEX IF NOT EXISTS "video_hotspots_product_id_idx" ON "video_hotspots"("product_id");
CREATE INDEX IF NOT EXISTS "video_hotspots_is_active_idx"  ON "video_hotspots"("is_active");
DO $$ BEGIN
  ALTER TABLE "video_hotspots" ADD CONSTRAINT "video_hotspots_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "shop_virtual_walk_videos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "video_hotspots" ADD CONSTRAINT "video_hotspots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. Mall creation audit log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mall_creation_logs" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "mall_id"       UUID,
    "payload"       JSONB        NOT NULL,
    "error_message" TEXT,
    "success"       BOOLEAN      NOT NULL DEFAULT false,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mall_creation_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mall_creation_logs_mall_id_idx"    ON "mall_creation_logs"("mall_id");
CREATE INDEX IF NOT EXISTS "mall_creation_logs_success_idx"    ON "mall_creation_logs"("success");
CREATE INDEX IF NOT EXISTS "mall_creation_logs_created_at_idx" ON "mall_creation_logs"("created_at");
DO $$ BEGIN
  ALTER TABLE "mall_creation_logs" ADD CONSTRAINT "mall_creation_logs_mall_id_fkey" FOREIGN KEY ("mall_id") REFERENCES "malls"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
