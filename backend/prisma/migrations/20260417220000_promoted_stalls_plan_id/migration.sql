-- Add promoted fields to stalls
ALTER TABLE "stalls" ADD COLUMN IF NOT EXISTS "is_promoted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stalls" ADD COLUMN IF NOT EXISTS "promoted_until" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "stalls_is_promoted_idx" ON "stalls"("is_promoted");

-- Add plan_id FK to subscriptions (nullable, no hard FK to allow plan deletion)
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "plan_id" UUID;
