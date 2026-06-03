-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "revenueCatOriginalTransactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_revenueCatOriginalTransactionId_key" ON "Subscription"("revenueCatOriginalTransactionId");
