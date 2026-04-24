-- Add promoted listing fields to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_promoted"    BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "promoted_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "products_is_promoted_idx" ON "products"("is_promoted");
