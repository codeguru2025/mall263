-- Migration: add_cities_vsw_shop_settings
-- Adds: cities table, converts malls.city TEXT → city_id FK,
--       shop_settings, shop_virtual_walk_videos, video_hotspots, mall_creation_logs

-- ── 1. ShelfLayer enum ────────────────────────────────────────────────────────
CREATE TYPE "ShelfLayer" AS ENUM ('MIDDLE', 'TOP', 'BOTTOM');

-- ── 2. Cities table ───────────────────────────────────────────────────────────
CREATE TABLE "cities" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"       TEXT        NOT NULL,
    "country"    TEXT        NOT NULL DEFAULT 'ZW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");
CREATE INDEX "cities_country_idx" ON "cities"("country");

-- ── 3. Migrate malls.city TEXT → city_id UUID FK ──────────────────────────────

-- 3a. Add nullable city_id column
ALTER TABLE "malls" ADD COLUMN "city_id" UUID;

-- 3b. Seed cities from existing mall.city text values, then link
--     (safe for empty DB; preserves data when run on a live DB)
INSERT INTO "cities" ("name")
SELECT DISTINCT TRIM("city") FROM "malls" WHERE TRIM("city") <> ''
ON CONFLICT ("name") DO NOTHING;

UPDATE "malls" m
SET "city_id" = c."id"
FROM "cities" c
WHERE LOWER(TRIM(m."city")) = LOWER(TRIM(c."name"));

-- 3c. For any rows still null (city was blank), set a default placeholder city
INSERT INTO "cities" ("name") VALUES ('Unknown') ON CONFLICT ("name") DO NOTHING;
UPDATE "malls" SET "city_id" = (SELECT "id" FROM "cities" WHERE "name" = 'Unknown' LIMIT 1)
WHERE "city_id" IS NULL;

-- 3d. Make city_id NOT NULL now that all rows are filled
ALTER TABLE "malls" ALTER COLUMN "city_id" SET NOT NULL;

-- 3e. Drop old text column and its index
DROP INDEX IF EXISTS "malls_city_idx";
ALTER TABLE "malls" DROP COLUMN "city";

-- 3f. Add FK constraint and indexes
ALTER TABLE "malls"
    ADD CONSTRAINT "malls_city_id_fkey"
    FOREIGN KEY ("city_id") REFERENCES "cities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3g. Unique name per city, and supporting indexes
ALTER TABLE "malls" ADD CONSTRAINT "malls_city_id_name_key" UNIQUE ("city_id", "name");
CREATE INDEX "malls_city_id_idx" ON "malls"("city_id");

-- ── 4. Shop settings ──────────────────────────────────────────────────────────
CREATE TABLE "shop_settings" (
    "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    "stall_id"            UUID        NOT NULL,
    "show_on_marketplace" BOOLEAN     NOT NULL DEFAULT true,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shop_settings_stall_id_key" ON "shop_settings"("stall_id");
ALTER TABLE "shop_settings"
    ADD CONSTRAINT "shop_settings_stall_id_fkey"
    FOREIGN KEY ("stall_id") REFERENCES "stalls"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. Virtual walk videos ────────────────────────────────────────────────────
CREATE TABLE "shop_virtual_walk_videos" (
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
CREATE INDEX "shop_virtual_walk_videos_shop_id_idx"   ON "shop_virtual_walk_videos"("shop_id");
CREATE INDEX "shop_virtual_walk_videos_is_active_idx" ON "shop_virtual_walk_videos"("is_active");
ALTER TABLE "shop_virtual_walk_videos"
    ADD CONSTRAINT "shop_virtual_walk_videos_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "stalls"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 6. Video hotspots ─────────────────────────────────────────────────────────
CREATE TABLE "video_hotspots" (
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
CREATE INDEX "video_hotspots_video_id_idx"   ON "video_hotspots"("video_id");
CREATE INDEX "video_hotspots_product_id_idx" ON "video_hotspots"("product_id");
CREATE INDEX "video_hotspots_is_active_idx"  ON "video_hotspots"("is_active");
ALTER TABLE "video_hotspots"
    ADD CONSTRAINT "video_hotspots_video_id_fkey"
    FOREIGN KEY ("video_id") REFERENCES "shop_virtual_walk_videos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_hotspots"
    ADD CONSTRAINT "video_hotspots_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 7. Mall creation audit log ────────────────────────────────────────────────
CREATE TABLE "mall_creation_logs" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "mall_id"       UUID,
    "payload"       JSONB        NOT NULL,
    "error_message" TEXT,
    "success"       BOOLEAN      NOT NULL DEFAULT false,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mall_creation_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mall_creation_logs_mall_id_idx"    ON "mall_creation_logs"("mall_id");
CREATE INDEX "mall_creation_logs_success_idx"    ON "mall_creation_logs"("success");
CREATE INDEX "mall_creation_logs_created_at_idx" ON "mall_creation_logs"("created_at");
ALTER TABLE "mall_creation_logs"
    ADD CONSTRAINT "mall_creation_logs_mall_id_fkey"
    FOREIGN KEY ("mall_id") REFERENCES "malls"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
