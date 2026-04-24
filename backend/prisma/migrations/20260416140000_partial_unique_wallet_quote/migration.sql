-- One completed deposit idempotency key per wallet (Paynow reference, etc.)
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_external_ref_key"
ON "wallet_transactions" ("wallet_id", "external_ref")
WHERE "external_ref" IS NOT NULL;

-- At most one PENDING quote per provider per service request (concurrency-safe)
CREATE UNIQUE INDEX IF NOT EXISTS "service_quotes_one_pending_per_provider_request_idx"
ON "service_quotes" ("request_id", "provider_id")
WHERE "status" = 'PENDING'::"ServiceQuoteStatus";
