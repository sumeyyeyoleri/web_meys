-- CreateEnum
CREATE TYPE "Space" AS ENUM ('LIVING_ROOM', 'BEDROOM', 'KIDS_ROOM', 'KITCHEN', 'CAFE_SHOP', 'OFFICE', 'OUTDOOR');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "inspirationItemId" UUID;

-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "allowSimilarRequest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "spaces" "Space"[] DEFAULT ARRAY[]::"Space"[];

-- AlterTable
ALTER TABLE "SiteSettings" ALTER COLUMN "accentColor" SET DEFAULT '#E8D3A8';

-- CreateIndex
CREATE INDEX "Order_inspirationItemId_idx" ON "Order"("inspirationItemId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_inspirationItemId_fkey" FOREIGN KEY ("inspirationItemId") REFERENCES "PortfolioItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
