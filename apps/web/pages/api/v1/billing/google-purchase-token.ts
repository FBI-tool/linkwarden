import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@linkwarden/prisma";
import verifyToken from "@/lib/api/verifyToken";

export default async function googlePurchaseToken(
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

  const token = await verifyToken({ req });

  if (typeof token === "string") {
    return res.status(401).json({ response: token });
  }

  const purchaseToken = req.body?.purchaseToken;

  if (typeof purchaseToken !== "string" || !purchaseToken.trim()) {
    return res.status(400).json({ response: "Missing purchase token." });
  }

  try {
    const { count } = await prisma.subscription.updateMany({
      where: {
        userId: token.id,
        provider: "REVENUECAT",
        store: "PLAY_STORE",
      },
      data: {
        googlePurchaseToken: purchaseToken,
      },
    });

    return res.status(200).json({ response: "Done!", updated: count });
  } catch (error) {
    return res
      .status(409)
      .json({ response: "Purchase token already in use.", updated: 0 });
  }
}
