-- CreateIndex
CREATE INDEX IF NOT EXISTS "buyer_demands_mall_id_idx" ON "buyer_demands"("mall_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "buyer_demands" ADD CONSTRAINT "buyer_demands_mall_id_fkey" FOREIGN KEY ("mall_id") REFERENCES "malls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
