-- Add attachment metadata to chat_messages so clients can send images / video
-- alongside (or instead of) text. content stays NOT NULL; callers pass an
-- empty string when only media is shared.

ALTER TABLE "chat_messages"
  ADD COLUMN "attachment_url"    TEXT,
  ADD COLUMN "attachment_type"   TEXT,
  ADD COLUMN "attachment_width"  INTEGER,
  ADD COLUMN "attachment_height" INTEGER,
  ADD COLUMN "attachment_size"   INTEGER;
