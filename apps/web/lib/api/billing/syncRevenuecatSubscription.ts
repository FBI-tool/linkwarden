import { prisma } from "@linkwarden/prisma";
import type { Prisma, User } from "@linkwarden/prisma/client";
import checkRevenuecatSubscription from "./checkRevenuecatSubscription";

const hasRevenuecatCredentials = () =>
  Boolean(process.env.REVENUECAT_PROJECT_ID && process.env.REVENUECAT_API_KEY);

export default async function syncRevenuecatSubscription(
  user: Pick<User, "id" | "uuid">
) {
  if (!hasRevenuecatCredentials()) return null;

  const subscription = await checkRevenuecatSubscription(user.uuid);

  if (
    !subscription ||
    !subscription.active ||
    !subscription.currentPeriodEnd ||
    !subscription.storeOriginalTransactionId ||
    !subscription.currentPeriodStart
  ) {
    await prisma.subscription.updateMany({
      where: {
        provider: "REVENUECAT",
        OR: [{ userId: user.id }, { revenueCatAppUserId: user.uuid }],
      },
      data: {
        active: false,
      },
    });

    return null;
  }

  const isGooglePlay = subscription.store === "PLAY_STORE";

  const data = {
    active: subscription.active,
    provider: "REVENUECAT" as const,
    // Clear any leftover Stripe identifier when switching Stripe -> RevenueCat.
    stripeSubscriptionId: null,
    revenueCatAppUserId: user.uuid,
    store: subscription.store,
    storeOriginalTransactionId: subscription.storeOriginalTransactionId,
    storeProductId: subscription.storeProductId,
    revenuecatMetadata: subscription.raw as Prisma.InputJsonValue,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    quantity: 1,
    // Leave the client-captured token alone for Google Play; clear a stale one
    // when switching to a non-Google store (e.g. Google -> Apple).
    ...(isGooglePlay ? {} : { googlePurchaseToken: null }),
  };

  const existingSubscription = await prisma.subscription.findUnique({
    where: {
      revenueCatAppUserId: user.uuid,
    },
  });

  if (existingSubscription) {
    return prisma.subscription.update({
      where: {
        id: existingSubscription.id,
      },
      data: {
        ...data,
        userId: user.id,
      },
    });
  }

  return prisma.subscription.upsert({
    where: {
      userId: user.id,
    },
    create: {
      ...data,
      userId: user.id,
    },
    update: data,
  });
}
