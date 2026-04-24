-- Add attachment metadata to chat_messages (idempotent)
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_url"    TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_type"   TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_width"  INTEGER;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_height" INTEGER;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_size"   INTEGER;
