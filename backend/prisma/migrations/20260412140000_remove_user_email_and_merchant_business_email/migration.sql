-- Drop indexes on users.email before removing column
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "users_email_idx";

ALTER TABLE "users" DROP COLUMN IF EXISTS "email";

ALTER TABLE "merchants" DROP COLUMN IF EXISTS "business_email";
