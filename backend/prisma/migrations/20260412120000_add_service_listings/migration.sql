-- CreateTable (idempotent: table may already exist on drifted DBs)
CREATE TABLE IF NOT EXISTS "service_listings" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "stall_id" UUID,
    "mall_id" UUID,
    "category_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_from" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_listings_provider_id_idx" ON "service_listings"("provider_id");
CREATE INDEX IF NOT EXISTS "service_listings_stall_id_idx" ON "service_listings"("stall_id");
CREATE INDEX IF NOT EXISTS "service_listings_mall_id_idx" ON "service_listings"("mall_id");
CREATE INDEX IF NOT EXISTS "service_listings_category_id_idx" ON "service_listings"("category_id");
CREATE INDEX IF NOT EXISTS "service_listings_is_active_idx" ON "service_listings"("is_active");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_mall_id_fkey" FOREIGN KEY ("mall_id") REFERENCES "malls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
