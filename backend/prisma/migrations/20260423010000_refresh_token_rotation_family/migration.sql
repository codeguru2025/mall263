-- Add rotation-family fields to refresh_tokens (idempotent for drifted DBs)

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "family_id"        UUID;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "replaced_by_id"   UUID;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "revoked_reason"   TEXT;

-- Backfill: every pre-existing token becomes its own family.
UPDATE "refresh_tokens" SET "family_id" = gen_random_uuid() WHERE "family_id" IS NULL;

-- Enforce NOT NULL going forward and make the default server-side.
ALTER TABLE "refresh_tokens"
  ALTER COLUMN "family_id" SET DEFAULT gen_random_uuid();
ALTER TABLE "refresh_tokens"
  ALTER COLUMN "family_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
