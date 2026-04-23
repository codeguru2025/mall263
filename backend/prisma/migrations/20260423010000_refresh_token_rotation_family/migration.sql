-- Add rotation-family fields to refresh_tokens for reuse/replay detection.
--
-- `family_id` groups every token issued in a single login→refresh chain.
-- `replaced_by_id` points to the token that superseded this one at rotation.
-- `revoked_reason` is a free-form tag ("ROTATED" | "LOGOUT" | "FAMILY_COMPROMISED").

ALTER TABLE "refresh_tokens"
  ADD COLUMN "family_id"        UUID,
  ADD COLUMN "replaced_by_id"   UUID,
  ADD COLUMN "revoked_reason"   TEXT;

-- Backfill: every pre-existing token becomes its own family.
UPDATE "refresh_tokens" SET "family_id" = gen_random_uuid() WHERE "family_id" IS NULL;

-- Enforce NOT NULL going forward and make the default server-side.
ALTER TABLE "refresh_tokens"
  ALTER COLUMN "family_id" SET NOT NULL,
  ALTER COLUMN "family_id" SET DEFAULT gen_random_uuid();

CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
