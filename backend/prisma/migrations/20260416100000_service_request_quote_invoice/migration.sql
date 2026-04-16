-- Service request / quote / invoice / chat flow

CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'QUOTED', 'ACCEPTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ServiceQuoteStatus"   AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ServiceInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

CREATE TABLE "service_requests" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "listing_id"  UUID          NOT NULL,
  "client_id"   UUID          NOT NULL,
  "notes"       TEXT,
  "budget_hint" DECIMAL(12,2),
  "status"      "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_quotes" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "request_id"     UUID         NOT NULL,
  "provider_id"    UUID         NOT NULL,
  "amount"         DECIMAL(12,2) NOT NULL,
  "description"    TEXT,
  "estimated_days" INTEGER,
  "status"         "ServiceQuoteStatus" NOT NULL DEFAULT 'PENDING',
  "responded_at"   TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_invoices" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "quote_id"       UUID         NOT NULL,
  "invoice_number" TEXT         NOT NULL,
  "data"           JSONB        NOT NULL,
  "total_amount"   DECIMAL(12,2) NOT NULL,
  "payment_method" TEXT         NOT NULL DEFAULT 'CASH',
  "status"         "ServiceInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_chat_rooms" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "quote_id"   UUID         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_chat_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_chat_messages" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "room_id"    UUID         NOT NULL,
  "sender_id"  UUID         NOT NULL,
  "content"    TEXT         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_chat_messages_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "service_invoices_quote_id_key"      ON "service_invoices"("quote_id");
CREATE UNIQUE INDEX "service_invoices_invoice_number_key" ON "service_invoices"("invoice_number");
CREATE UNIQUE INDEX "service_chat_rooms_quote_id_key"    ON "service_chat_rooms"("quote_id");

-- Indexes
CREATE INDEX "service_requests_listing_id_idx"     ON "service_requests"("listing_id");
CREATE INDEX "service_requests_client_id_idx"      ON "service_requests"("client_id");
CREATE INDEX "service_requests_status_idx"         ON "service_requests"("status");
CREATE INDEX "service_quotes_request_id_idx"       ON "service_quotes"("request_id");
CREATE INDEX "service_quotes_provider_id_idx"      ON "service_quotes"("provider_id");
CREATE INDEX "service_quotes_status_idx"           ON "service_quotes"("status");
CREATE INDEX "service_invoices_invoice_number_idx" ON "service_invoices"("invoice_number");
CREATE INDEX "service_chat_messages_room_id_idx"   ON "service_chat_messages"("room_id");
CREATE INDEX "service_chat_messages_created_at_idx" ON "service_chat_messages"("created_at");

-- Foreign keys
ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_listing_id_fkey"
    FOREIGN KEY ("listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "service_requests_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "users"("id") ON UPDATE CASCADE;

ALTER TABLE "service_quotes"
  ADD CONSTRAINT "service_quotes_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "service_quotes_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON UPDATE CASCADE;

ALTER TABLE "service_invoices"
  ADD CONSTRAINT "service_invoices_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "service_quotes"("id") ON UPDATE CASCADE;

ALTER TABLE "service_chat_rooms"
  ADD CONSTRAINT "service_chat_rooms_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "service_quotes"("id") ON UPDATE CASCADE;

ALTER TABLE "service_chat_messages"
  ADD CONSTRAINT "service_chat_messages_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "service_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "service_chat_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON UPDATE CASCADE;
