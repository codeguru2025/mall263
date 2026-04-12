-- Merchant / stall branding and public storefront view counter
ALTER TABLE "merchants" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "stalls" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "stalls" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;
