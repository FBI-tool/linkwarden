-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "storeEnvironment",
ADD COLUMN     "googlePurchaseToken" TEXT;

-- DropEnum
DROP TYPE "SubscriptionEnvironment";

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_googlePurchaseToken_key" ON "Subscription"("googlePurchaseToken");

