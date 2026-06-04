type RevenueCatSubscription = {
  id: string;
  product_id: string;
  current_period_starts_at: number | null;
  current_period_ends_at: number | null;
  store_subscription_identifier: string | number | null;
  gives_access: boolean;
  status: string;
  entitlements?: {
    items?: {
      lookup_key?: string;
      state?: string;
    }[];
  };
};

export default async function checkRevenuecatSubscription(appUserId: string) {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  const apiKey = process.env.REVENUECAT_API_KEY;

  if (!projectId || !apiKey)
    throw new Error(
      `Missing REVENUECAT_PROJECT_ID/REVENUECAT_API_KEY envirnonment variables!`
    );

  const entitlementId = "Linkwarden Cloud";

  const res = await fetch(
    `https://api.revenuecat.com/v2/projects/${projectId}/customers/${encodeURIComponent(
      appUserId
    )}/subscriptions?limit=20`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`RevenueCat API error: ${res.status}`);

  const data = (await res.json()) as { items?: RevenueCatSubscription[] };

  const sub = data.items
    ?.filter((s) => {
      const hasEntitlement = s.entitlements?.items?.some(
        (e) => e.lookup_key === entitlementId && e.state === "active"
      );

      return s.gives_access && hasEntitlement;
    })
    .sort(
      (a, b) =>
        (b.current_period_ends_at ?? 0) - (a.current_period_ends_at ?? 0)
    )[0];

  if (!sub?.current_period_starts_at || !sub?.current_period_ends_at) {
    return null;
  }

  return {
    active: sub.gives_access,
    revenueCatSubscriptionId: sub.id,
    revenueCatProductId: sub.product_id,
    revenueCatOriginalTransactionId: sub.store_subscription_identifier
      ? String(sub.store_subscription_identifier)
      : null,
    currentPeriodStart: new Date(sub.current_period_starts_at),
    currentPeriodEnd: new Date(sub.current_period_ends_at),
  };
}
