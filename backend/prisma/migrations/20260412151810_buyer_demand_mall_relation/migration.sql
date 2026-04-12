-- CreateIndex
CREATE INDEX "buyer_demands_mall_id_idx" ON "buyer_demands"("mall_id");

-- AddForeignKey
ALTER TABLE "buyer_demands" ADD CONSTRAINT "buyer_demands_mall_id_fkey" FOREIGN KEY ("mall_id") REFERENCES "malls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
