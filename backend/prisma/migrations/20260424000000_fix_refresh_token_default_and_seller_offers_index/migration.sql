-- Drop the DB-level default on family_id so Prisma generates the UUID in
-- application code (via @default(uuid())) rather than at the database level.
-- The previous migration set DEFAULT gen_random_uuid() as a one-time backfill
-- helper; it is no longer needed now that all rows have a value.
ALTER TABLE "refresh_tokens"
  ALTER COLUMN "family_id" DROP DEFAULT;

-- Add the missing index on seller_offers.expires_at.
-- This was present in the schema (@@index([expiresAt])) but never applied.
CREATE INDEX IF NOT EXISTS "seller_offers_expires_at_idx"
  ON "seller_offers"("expires_at");
