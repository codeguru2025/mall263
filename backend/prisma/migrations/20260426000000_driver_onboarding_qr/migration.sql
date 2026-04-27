-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'BOGO', 'BOGO_PERCENTAGE');

-- CreateEnum
CREATE TYPE "DiscountReason" AS ENUM ('PROMOTION', 'LOYALTY', 'BULK_PURCHASE', 'SEASONAL', 'CLEARANCE', 'EMPLOYEE', 'CUSTOMER_REQUEST', 'DAMAGED_GOODS', 'COMPETITOR_MATCH');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('OPEN', 'LOCKED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "RunBidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RunStopStatus" AS ENUM ('PENDING', 'PICKED_UP');

-- CreateEnum
CREATE TYPE "RunQrTokenType" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "DriverDocumentType" AS ENUM ('DRIVERS_LICENSE', 'POLICE_CLEARANCE', 'PROOF_OF_RESIDENCE', 'CAR_REG_BOOK', 'INSURANCE', 'ZINARA', 'NATIONAL_ID');

-- CreateEnum
CREATE TYPE "DriverDocumentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RUN_BID_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_BID_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_LOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_STOP_PICKED_UP';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_DELIVERED';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_COLLECTION_PROOF';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_DELIVERY_PROOF';
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_DOC_VERIFIED';
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_DOC_REJECTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTransactionType" ADD VALUE 'RUN_ESCROW_LOCK';
ALTER TYPE "WalletTransactionType" ADD VALUE 'RUN_ESCROW_RELEASE';
ALTER TYPE "WalletTransactionType" ADD VALUE 'RUN_DRIVER_EARNING';

-- DropForeignKey
ALTER TABLE "cod_transactions" DROP CONSTRAINT "cod_transactions_driver_id_fkey";

-- DropForeignKey
ALTER TABLE "cod_transactions" DROP CONSTRAINT "cod_transactions_job_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_jobs" DROP CONSTRAINT "delivery_jobs_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_jobs" DROP CONSTRAINT "delivery_jobs_driver_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_jobs" DROP CONSTRAINT "delivery_jobs_seller_id_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_job_id_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_raised_by_id_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_resolved_by_id_fkey";

-- DropForeignKey
ALTER TABLE "driver_float_transactions" DROP CONSTRAINT "driver_float_transactions_driver_id_fkey";

-- DropForeignKey
ALTER TABLE "drivers" DROP CONSTRAINT "drivers_user_id_fkey";

-- DropForeignKey
ALTER TABLE "escrow_accounts" DROP CONSTRAINT "escrow_accounts_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "escrow_accounts" DROP CONSTRAINT "escrow_accounts_job_id_fkey";

-- DropForeignKey
ALTER TABLE "service_chat_messages" DROP CONSTRAINT "service_chat_messages_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "service_chat_rooms" DROP CONSTRAINT "service_chat_rooms_quote_id_fkey";

-- DropForeignKey
ALTER TABLE "service_invoices" DROP CONSTRAINT "service_invoices_quote_id_fkey";

-- DropForeignKey
ALTER TABLE "service_quotes" DROP CONSTRAINT "service_quotes_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "service_requests" DROP CONSTRAINT "service_requests_client_id_fkey";

-- DropForeignKey
ALTER TABLE "stall_follows" DROP CONSTRAINT "stall_follows_stall_id_fkey";

-- DropForeignKey
ALTER TABLE "stall_follows" DROP CONSTRAINT "stall_follows_user_id_fkey";

-- AlterTable
ALTER TABLE "ads" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_commissions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "edited_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cities" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cod_transactions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "delivery_jobs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "disputes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "driver_float_transactions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "drivers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "escrow_accounts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mall_creation_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pos_sales" ADD COLUMN     "discount_code" TEXT,
ADD COLUMN     "discount_id" UUID,
ADD COLUMN     "discount_reason" "DiscountReason",
DROP COLUMN "discount_type",
ADD COLUMN     "discount_type" "DiscountType";

-- AlterTable
ALTER TABLE "product_reviews" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "promotions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "risk_reserve_pool" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_chat_messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_chat_rooms" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_invoices" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_quotes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shop_settings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shop_virtual_walk_videos" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stall_follows" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscription_plans" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "support_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_addresses" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "video_hotspots" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "discounts" (
    "id" UUID NOT NULL,
    "stall_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "min_amount" DECIMAL(14,2),
    "max_discount" DECIMAL(14,2),
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "reason" "DiscountReason" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "driver_id" UUID,
    "mode" "DeliveryMode" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'OPEN',
    "drop_zone" TEXT NOT NULL,
    "drop_address" TEXT,
    "drop_lat" DECIMAL(10,8),
    "drop_lng" DECIMAL(11,8),
    "total_distance_km" DECIMAL(8,2),
    "suggested_fee" DECIMAL(14,2),
    "max_budget" DECIMAL(14,2),
    "agreed_fee" DECIMAL(14,2),
    "platform_fee" DECIMAL(14,2),
    "driver_earning" DECIMAL(14,2),
    "delivery_photo_url" TEXT,
    "delivery_video_url" TEXT,
    "delivery_timestamp" TIMESTAMP(3),
    "delivery_gps_lat" DECIMAL(10,8),
    "delivery_gps_lng" DECIMAL(11,8),
    "locked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_stops" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "stall_id" UUID NOT NULL,
    "stop_order" INTEGER NOT NULL,
    "status" "RunStopStatus" NOT NULL DEFAULT 'PENDING',
    "pickup_pin" TEXT NOT NULL,
    "picked_up_at" TIMESTAMP(3),
    "pickup_gps_lat" DECIMAL(10,8),
    "pickup_gps_lng" DECIMAL(11,8),
    "item_amount" DECIMAL(14,2) NOT NULL,
    "collection_photo_url" TEXT,
    "collection_video_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_stop_items" (
    "id" UUID NOT NULL,
    "stop_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "run_stop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_bids" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "fee" DECIMAL(14,2) NOT NULL,
    "message" TEXT,
    "status" "RunBidStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_escrows" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "total_held" DECIMAL(14,2) NOT NULL,
    "item_amount" DECIMAL(14,2) NOT NULL,
    "delivery_fee" DECIMAL(14,2) NOT NULL,
    "platform_fee" DECIMAL(14,2) NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_escrows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_qr_tokens" (
    "id" UUID NOT NULL,
    "token" UUID NOT NULL,
    "type" "RunQrTokenType" NOT NULL,
    "run_id" UUID NOT NULL,
    "stop_id" UUID,
    "driver_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_qr_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_documents" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "type" "DriverDocumentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "DriverDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejected_reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discounts_code_key" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discounts_stall_id_idx" ON "discounts"("stall_id");

-- CreateIndex
CREATE INDEX "discounts_code_idx" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discounts_is_active_idx" ON "discounts"("is_active");

-- CreateIndex
CREATE INDEX "discounts_starts_at_ends_at_idx" ON "discounts"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "runs_status_idx" ON "runs"("status");

-- CreateIndex
CREATE INDEX "runs_buyer_id_idx" ON "runs"("buyer_id");

-- CreateIndex
CREATE INDEX "runs_driver_id_idx" ON "runs"("driver_id");

-- CreateIndex
CREATE INDEX "runs_mode_status_idx" ON "runs"("mode", "status");

-- CreateIndex
CREATE INDEX "run_stops_run_id_idx" ON "run_stops"("run_id");

-- CreateIndex
CREATE INDEX "run_stops_stall_id_idx" ON "run_stops"("stall_id");

-- CreateIndex
CREATE INDEX "run_stop_items_stop_id_idx" ON "run_stop_items"("stop_id");

-- CreateIndex
CREATE INDEX "run_bids_run_id_status_idx" ON "run_bids"("run_id", "status");

-- CreateIndex
CREATE INDEX "run_bids_driver_id_idx" ON "run_bids"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "run_bids_run_id_driver_id_key" ON "run_bids"("run_id", "driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "run_escrows_run_id_key" ON "run_escrows"("run_id");

-- CreateIndex
CREATE INDEX "run_escrows_buyer_id_idx" ON "run_escrows"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "run_qr_tokens_token_key" ON "run_qr_tokens"("token");

-- CreateIndex
CREATE INDEX "run_qr_tokens_token_idx" ON "run_qr_tokens"("token");

-- CreateIndex
CREATE INDEX "run_qr_tokens_run_id_idx" ON "run_qr_tokens"("run_id");

-- CreateIndex
CREATE INDEX "run_qr_tokens_driver_id_idx" ON "run_qr_tokens"("driver_id");

-- CreateIndex
CREATE INDEX "driver_documents_driver_id_idx" ON "driver_documents"("driver_id");

-- CreateIndex
CREATE INDEX "driver_documents_status_idx" ON "driver_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "driver_documents_driver_id_type_key" ON "driver_documents"("driver_id", "type");

-- CreateIndex
CREATE INDEX "malls_is_active_idx" ON "malls"("is_active");

-- CreateIndex
CREATE INDEX "pos_sales_discount_id_idx" ON "pos_sales"("discount_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_external_ref_idx" ON "wallet_transactions"("external_ref");

-- AddForeignKey
ALTER TABLE "stall_follows" ADD CONSTRAINT "stall_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stall_follows" ADD CONSTRAINT "stall_follows_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_invoices" ADD CONSTRAINT "service_invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "service_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_chat_rooms" ADD CONSTRAINT "service_chat_rooms_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "service_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_chat_messages" ADD CONSTRAINT "service_chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_transactions" ADD CONSTRAINT "cod_transactions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_transactions" ADD CONSTRAINT "cod_transactions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_float_transactions" ADD CONSTRAINT "driver_float_transactions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "delivery_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_stops" ADD CONSTRAINT "run_stops_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_stops" ADD CONSTRAINT "run_stops_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_stop_items" ADD CONSTRAINT "run_stop_items_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "run_stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_stop_items" ADD CONSTRAINT "run_stop_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_bids" ADD CONSTRAINT "run_bids_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_bids" ADD CONSTRAINT "run_bids_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_escrows" ADD CONSTRAINT "run_escrows_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_escrows" ADD CONSTRAINT "run_escrows_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_qr_tokens" ADD CONSTRAINT "run_qr_tokens_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_qr_tokens" ADD CONSTRAINT "run_qr_tokens_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "run_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_qr_tokens" ADD CONSTRAINT "run_qr_tokens_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_qr_tokens" ADD CONSTRAINT "run_qr_tokens_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add pickup point statuses to RunStatus enum
ALTER TYPE "RunStatus" ADD VALUE 'AT_PICKUP_POINT';
ALTER TYPE "RunStatus" ADD VALUE 'COLLECTED';

-- Add pickup point notification types
ALTER TYPE "NotificationType" ADD VALUE 'RUN_READY_FOR_COLLECTION';
ALTER TYPE "NotificationType" ADD VALUE 'RUN_COLLECTED';

-- CreateTable: pickup_points
CREATE TABLE "pickup_points" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_points_pkey" PRIMARY KEY ("id")
);

-- AlterTable: runs — add pickup point columns
ALTER TABLE "runs"
    ADD COLUMN "pickup_point_id" UUID,
    ADD COLUMN "collection_code" TEXT,
    ADD COLUMN "collection_token" UUID,
    ADD COLUMN "collected_at" TIMESTAMP(3),
    ADD COLUMN "collected_by_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "runs_collection_token_key" ON "runs"("collection_token");

-- CreateIndex
CREATE INDEX "runs_pickup_point_id_idx" ON "runs"("pickup_point_id");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "pickup_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

