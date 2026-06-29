import type { NextApiRequest, NextApiResponse } from "next";
import getUserById from "@/lib/api/controllers/users/userId/getUserById";
import syncRevenuecatSubscription from "@/lib/api/billing/syncRevenuecatSubscription";
import verifyToken from "@/lib/api/verifyToken";
import { prisma } from "@linkwarden/prisma";

const syncRevenuecatSubscriptionIfNeeded = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      uuid: true,
      subscriptions: {
        select: {
          active: true,
          provider: true,
          currentPeriodEnd: true,
        },
      },
      parentSubscription: {
        select: {
          active: true,
        },
      },
    },
  });

  if (!user || user.parentSubscription?.active) return;

  const shouldSyncRevenuecatSubscription =
    !user.subscriptions ||
    !user.subscriptions.active ||
    (user.subscriptions.provider === "REVENUECAT" &&
      new Date() > user.subscriptions.currentPeriodEnd);

  if (!shouldSyncRevenuecatSubscription) return;

  await syncRevenuecatSubscription(user).catch((error) => {
    console.error("Error syncing RevenueCat subscription:", error);
  });
};

export default async function me(req: NextApiRequest, res: NextApiResponse) {
  const token = await verifyToken({ req });

  if (typeof token === "string") {
    res.status(401).json({ response: token });
    return null;
  }

  const userId = token.id;

  if (req.method === "GET") {
    await syncRevenuecatSubscriptionIfNeeded(userId);

    const users = await getUserById(userId);
    return res.status(users.status).json({ response: users.response });
  }
}
