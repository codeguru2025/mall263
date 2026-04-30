-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "province" TEXT;

-- CreateIndex
CREATE INDEX "cities_is_active_idx" ON "cities"("is_active");

-- CreateIndex
CREATE INDEX "pickup_points_is_active_idx" ON "pickup_points"("is_active");
