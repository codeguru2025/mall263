-- Add address field to stalls for standalone shops not located inside a mall
ALTER TABLE "stalls" ADD COLUMN IF NOT EXISTS "address" TEXT;
