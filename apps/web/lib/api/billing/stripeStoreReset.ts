import { Prisma } from "@linkwarden/prisma/client";

// A Stripe subscription is web-only, so every write that sets `provider: "STRIPE"`
// clears the RevenueCat/IAP-store fields. This keeps a row that switched over from
// RevenueCat from carrying stale store identifiers, and is shared across every Stripe
// write path so they can't drift apart.
export const stripeStoreReset = {
  store: null,
  revenueCatAppUserId: null,
  storeOriginalTransactionId: null,
  storeProductId: null,
  googlePurchaseToken: null,
  revenuecatMetadata: Prisma.DbNull,
};
