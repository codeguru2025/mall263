CREATE TABLE IF NOT EXISTS "stall_follows" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID         NOT NULL,
  "stall_id"   UUID         NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "stall_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stall_follows_user_id_stall_id_key" ON "stall_follows"("user_id", "stall_id");

CREATE INDEX IF NOT EXISTS "stall_follows_stall_id_idx" ON "stall_follows"("stall_id");

DO $$ BEGIN
  ALTER TABLE "stall_follows" ADD CONSTRAINT "stall_follows_user_id_fkey"  FOREIGN KEY ("user_id")  REFERENCES "users"("id")  ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "stall_follows" ADD CONSTRAINT "stall_follows_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
