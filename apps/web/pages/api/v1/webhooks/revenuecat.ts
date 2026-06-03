import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@linkwarden/prisma";

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  environment?: "PRODUCTION" | "SANDBOX";
  original_transaction_id?: string;
  transaction_id?: string;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
};

const subscriptionEvents = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "CANCELLATION",
  "BILLING_ISSUE",
  "EXPIRATION",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);

export default async function revenueCatWebhook(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ response: "Method not allowed." });
  }

  if (process.env.NEXT_PUBLIC_DEMO === "true")
    return res.status(400).json({
      response:
        "This action is disabled because this is a read-only demo of Linkwarden.",
    });

  if (!process.env.REVENUECAT_WEBHOOK_AUTHORIZATION) {
    return res.status(400).json({
      response:
        "This action is disabled because RevenueCat is not initialized.",
    });
  }

  if (
    req.headers.authorization !== process.env.REVENUECAT_WEBHOOK_AUTHORIZATION
  ) {
    return res.status(401).json({ response: "Invalid authorization header." });
  }

  const event = req.body?.event as RevenueCatEvent | undefined;

  if (!event?.type || !subscriptionEvents.has(event.type)) {
    return res.status(200).json({ response: "Event ignored." });
  }

  if (
    event.environment === "SANDBOX" &&
    process.env.REVENUECAT_ACCEPT_SANDBOX_WEBHOOKS !== "true" &&
    process.env.NODE_ENV === "production"
  ) {
    return res.status(200).json({ response: "Sandbox event ignored." });
  }

  if (
    !event.original_app_user_id ||
    !event.purchased_at_ms ||
    !event.expiration_at_ms
  ) {
    return res.status(200).json({ response: "Event ignored." });
  }

  const currentPeriodStart = new Date(event.purchased_at_ms);
  const currentPeriodEnd = new Date(event.expiration_at_ms);
  const active = event.type !== "EXPIRATION" && currentPeriodEnd > new Date();

  try {
    const user = await prisma.user.findUnique({
      where: {
        uuid: event.original_app_user_id,
      },
    });

    if (!user) {
      return res.status(200).json({ response: "User not found." });
    }

    const subscription = await prisma.subscription.findUnique({
      where: {
        revenueCatAppUserId: event.original_app_user_id,
      },
    });

    if (subscription) {
      await prisma.subscription.update({
        where: {
          id: subscription.id,
        },
        data: {
          active,
          currentPeriodStart,
          currentPeriodEnd,
          quantity: 1,
          userId: user.id,
        },
      });
    } else {
      await prisma.subscription.upsert({
        where: {
          userId: user.id,
        },
        create: {
          active,
          provider: "REVENUECAT",
          revenueCatAppUserId: event.original_app_user_id,
          currentPeriodStart,
          currentPeriodEnd,
          quantity: 1,
          userId: user.id,
        },
        update: {
          active,
          revenueCatAppUserId: event.original_app_user_id,
          currentPeriodStart,
          currentPeriodEnd,
          quantity: 1,
        },
      });
    }
  } catch (error) {
    console.error("Error handling RevenueCat webhook event:", error);
    return res.status(500).send("Server Error");
  }

  return res.status(200).json({
    response: "Done!",
  });
}
