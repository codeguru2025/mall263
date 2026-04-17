-- Add Expo push token to users for mobile push notifications
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "push_token" TEXT;
