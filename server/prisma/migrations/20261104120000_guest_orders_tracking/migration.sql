-- Single-page order form with guest orders and private tracking links (PROMPT.md §6).
-- No order data is removed: fields of the former wizard stay on existing orders.

-- Guest orders have no account.
ALTER TABLE "Order" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "contactPhone" DROP NOT NULL;

-- Idempotency keys are random UUIDs; they are now unique on their own (guests have no customerId).
DROP INDEX "Order_customerId_idempotencyKey_key";
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- Guests can write messages and accept/cancel through the tracking link.
ALTER TABLE "OrderMessage" ALTER COLUMN "senderId" DROP NOT NULL;

ALTER TABLE "OrderStatusHistory" ADD COLUMN "changedByRole" "Role";
UPDATE "OrderStatusHistory" h SET "changedByRole" = u."role" FROM "User" u WHERE u."id" = h."changedById";
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "changedByRole" SET NOT NULL;
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "changedById" DROP NOT NULL;

-- Budget and deadline are no longer asked, so the "required" settings are gone.
ALTER TABLE "SiteSettings" DROP COLUMN "budgetRequired";
ALTER TABLE "SiteSettings" DROP COLUMN "deadlineRequired";

-- CreateTable
CREATE TABLE "OrderTrackingToken" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTrackingToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderTrackingToken_tokenHash_key" ON "OrderTrackingToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OrderTrackingToken_orderId_idx" ON "OrderTrackingToken"("orderId");

-- AddForeignKey
ALTER TABLE "OrderTrackingToken" ADD CONSTRAINT "OrderTrackingToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
