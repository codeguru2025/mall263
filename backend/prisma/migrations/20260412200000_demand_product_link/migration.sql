-- Link demands to specific products and stalls
ALTER TABLE "buyer_demands" ADD COLUMN IF NOT EXISTS "product_id" UUID;
ALTER TABLE "buyer_demands" ADD COLUMN IF NOT EXISTS "stall_id" UUID;

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "buyer_demands" ADD CONSTRAINT "buyer_demands_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "buyer_demands" ADD CONSTRAINT "buyer_demands_stall_id_fkey"
    FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "buyer_demands_product_id_idx" ON "buyer_demands"("product_id");
CREATE INDEX IF NOT EXISTS "buyer_demands_stall_id_idx" ON "buyer_demands"("stall_id");
