-- Link demands to specific products and stalls
ALTER TABLE "buyer_demands" ADD COLUMN "product_id" UUID;
ALTER TABLE "buyer_demands" ADD COLUMN "stall_id" UUID;

-- Foreign keys
ALTER TABLE "buyer_demands" ADD CONSTRAINT "buyer_demands_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "buyer_demands" ADD CONSTRAINT "buyer_demands_stall_id_fkey"
  FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "buyer_demands_product_id_idx" ON "buyer_demands"("product_id");
CREATE INDEX "buyer_demands_stall_id_idx" ON "buyer_demands"("stall_id");
