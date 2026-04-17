-- Add promoted listing fields to products table
ALTER TABLE "products" ADD COLUMN "is_promoted"    BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "promoted_until" TIMESTAMP(3);

CREATE INDEX "products_is_promoted_idx" ON "products"("is_promoted");
