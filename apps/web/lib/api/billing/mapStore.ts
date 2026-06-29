import type { SubscriptionStore } from "@linkwarden/prisma/client";

export default function mapStore(
  store?: string | null
): SubscriptionStore | undefined {
  switch (store?.toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "APP_STORE";
    case "PLAY_STORE":
      return "PLAY_STORE";
    default:
      return undefined;
  }
}
