-- Add ONEMONEY to PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ONEMONEY';

-- Add merchant payment codes to stalls
ALTER TABLE "stalls"
  ADD COLUMN IF NOT EXISTS "ecocash_merchant_code" TEXT,
  ADD COLUMN IF NOT EXISTS "onemoney_merchant_code" TEXT;
