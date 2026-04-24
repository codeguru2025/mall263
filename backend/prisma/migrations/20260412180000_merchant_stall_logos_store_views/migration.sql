-- Merchant / stall branding and public storefront view counter
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "stalls" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "stalls" ADD COLUMN IF NOT EXISTS "view_count" INTEGER NOT NULL DEFAULT 0;
