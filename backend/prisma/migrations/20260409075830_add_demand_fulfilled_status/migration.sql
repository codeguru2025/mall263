-- CreateEnum (idempotent: type may already exist on DBs with partial / manual apply)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
    CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');
  END IF;
END $$;

-- AlterEnum (idempotent: value may already exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'DemandStatus' AND e.enumlabel = 'FULFILLED'
  ) THEN
    ALTER TYPE "DemandStatus" ADD VALUE 'FULFILLED';
  END IF;
END $$;

-- CreateTable (idempotent: partial applies may have created some objects)
CREATE TABLE IF NOT EXISTS "chat_rooms" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "delivery_requests" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "buyer_address" TEXT,
    "buyer_lat" DOUBLE PRECISION,
    "buyer_lng" DOUBLE PRECISION,
    "distance_km" DOUBLE PRECISION,
    "delivery_fee" DECIMAL(10,2),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "chat_rooms_offer_id_key" ON "chat_rooms"("offer_id");

CREATE INDEX IF NOT EXISTS "chat_messages_room_id_created_at_idx" ON "chat_messages"("room_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_requests_offer_id_key" ON "delivery_requests"("offer_id");

CREATE INDEX IF NOT EXISTS "delivery_requests_offer_id_idx" ON "delivery_requests"("offer_id");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "seller_offers" ADD CONSTRAINT "seller_offers_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stalls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
