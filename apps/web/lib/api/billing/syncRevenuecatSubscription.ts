import { prisma } from "@linkwarden/prisma";
import type { User } from "@linkwarden/prisma/client";
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
    !subscription.revenueCatSubscriptionId ||
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

  const data = {
    active: subscription.active,
    provider: "REVENUECAT" as const,
    revenueCatAppUserId: user.uuid,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    quantity: 1,
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
