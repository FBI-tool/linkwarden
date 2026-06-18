import { Button } from "@/components/ui/Button";
import { rawTheme, ThemeName } from "@/lib/colors";
import {
  hasInactiveSubscription,
  shouldRouteToSubscribe,
} from "@/lib/subscription";
import { ensureCloudIsReachable } from "@/lib/ensureCloudIsReachable";
import useAuthStore from "@/store/auth";
import { useConfig } from "@linkwarden/router/config";
import { useUser } from "@linkwarden/router/user";
import { MobileAuth, Plan } from "@linkwarden/types/global";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import {
  Archive,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Search,
  Sparkles,
} from "lucide-react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import * as DropdownMenu from "zeego/dropdown-menu";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const saveGooglePurchaseToken = async (
  auth: MobileAuth,
  purchaseToken: string,
  attempts = 5
) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(
        `${auth.instance}/api/v1/billing/google-purchase-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.session}`,
          },
          body: JSON.stringify({ purchaseToken }),
        }
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.updated > 0) return;
      } else if (res.status === 409) {
        return;
      }
    } catch {}

    await wait(1500);
  }
};

const features = [
  { title: "Save & organize", icon: Bookmark },
  { title: "Permanent archives", icon: Archive },
  { title: "Reader view & highlights", icon: BookOpen },
  { title: "Full-text search", icon: Search },
  { title: "And more...", icon: Sparkles },
];

const paymentButton = Platform.select({
  ios: {
    accessibilityLabel: "Subscribe with Apple Pay",
    icon: "apple-pay",
    iconSize: 40,
  },
  android: {
    accessibilityLabel: "Subscribe with Google Pay",
    icon: "google-pay",
    iconSize: 40,
  },
  default: {
    accessibilityLabel: "Complete Subscription",
    iconSize: 0,
    label: "Complete Subscription",
  },
});

type RevenueCatPackages = {
  monthly: PurchasesPackage | null;
  yearly: PurchasesPackage | null;
};

const formatTrialPeriod = (
  unit?: string,
  units = 1,
  cycles: number | null = 1
) => {
  const total = Math.max(1, units * (cycles || 1));
  const normalizedUnit = (unit || "day").toLowerCase();
  const label = total === 1 ? normalizedUnit : `${normalizedUnit}s`;

  return `${total} ${label}`;
};

const getFreeTrialPeriod = (product?: PurchasesPackage["product"]) => {
  const freePhase = product?.defaultOption?.freePhase;

  if (freePhase) {
    return formatTrialPeriod(
      freePhase.billingPeriod.unit,
      freePhase.billingPeriod.value,
      freePhase.billingCycleCount
    );
  }

  if (product?.introPrice?.price === 0) {
    return formatTrialPeriod(
      product.introPrice.periodUnit,
      product.introPrice.periodNumberOfUnits,
      product.introPrice.cycles
    );
  }

  return null;
};

export default function SubscribeScreen() {
  const { auth, signOut } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const theme = rawTheme[colorScheme as ThemeName];
  const accentColor = colorScheme === "dark" ? "#A78BFA" : theme.accent;
  const insets = useSafeAreaInsets();
  const payButtonClass = colorScheme === "dark" ? "bg-white" : "bg-black";
  const payContentColor = colorScheme === "dark" ? "#000000" : "#FFFFFF";
  const [plan, setPlan] = useState<Plan>(Plan.yearly);
  const {
    data: user,
    isLoading: isUserLoading,
    refetch: refetchUser,
  } = useUser(auth);
  const config = useConfig(auth);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [revenueCatPackages, setRevenueCatPackages] =
    useState<RevenueCatPackages>({
      monthly: null,
      yearly: null,
    });

  const isForcedSubscribe = shouldRouteToSubscribe(user, config.data);
  const showSubscribe = hasInactiveSubscription(user, config.data);
  const isChecking =
    auth.status === "loading" ||
    (auth.status === "authenticated" && (isUserLoading || config.isLoading));

  useEffect(() => {
    if (auth.status === "unauthenticated") router.replace("/");
    if (auth.status === "authenticated" && !isChecking && !showSubscribe)
      router.replace("/(tabs)/dashboard");
  }, [auth.status, isChecking, showSubscribe]);

  useEffect(() => {
    let active = true;

    const fetchOfferings = async () => {
      try {
        if (!active) return;

        if (!(await Purchases.isConfigured())) {
          setTimeout(fetchOfferings, 250);
          return;
        }

        const offerings = await Purchases.getOfferings();
        if (!active) return;

        setRevenueCatPackages({
          monthly: offerings.current?.monthly ?? null,
          yearly: offerings.current?.annual ?? null,
        });
      } catch {}
    };

    fetchOfferings();

    return () => {
      active = false;
    };
  }, []);

  const planCards = useMemo(
    () => [
      {
        key: Plan.yearly,
        label: "Yearly",
        package: revenueCatPackages.yearly,
        price: revenueCatPackages.yearly?.product?.priceString ?? null,
        suffix: "/yr",
        caption: revenueCatPackages.yearly?.product?.pricePerMonthString
          ? `Only ${revenueCatPackages.yearly.product.pricePerMonthString}/mo`
          : null,
      },
      {
        key: Plan.monthly,
        label: "Monthly",
        package: revenueCatPackages.monthly,
        price: revenueCatPackages.monthly?.product?.priceString ?? null,
        suffix: "/mo",
        caption: revenueCatPackages.monthly?.product?.priceString
          ? `Billed at ${revenueCatPackages.monthly.product.priceString}/mo.`
          : null,
      },
    ],
    [revenueCatPackages.monthly, revenueCatPackages.yearly]
  );

  const savingsPercent = useMemo(() => {
    const monthlyPrice = revenueCatPackages.monthly?.product?.price;
    const yearlyPrice = revenueCatPackages.yearly?.product?.price;
    if (!monthlyPrice || !yearlyPrice) return null;
    const percent = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
    return percent > 0 ? percent : null;
  }, [revenueCatPackages.monthly, revenueCatPackages.yearly]);

  const selectedPlan = useMemo(() => {
    const selectedPackage =
      plan === Plan.monthly
        ? revenueCatPackages.monthly
        : revenueCatPackages.yearly;
    const product = selectedPackage?.product;
    const total = product?.priceString;
    const period = plan === Plan.monthly ? "month" : "year";
    const freeTrialPeriod = getFreeTrialPeriod(product);

    return {
      package: selectedPackage ?? null,
      footnote: total
        ? freeTrialPeriod
          ? `Get ${freeTrialPeriod} free, then ${total} per ${period}. Cancel anytime from your device settings.`
          : `${total} per ${period}. Cancel anytime from your device settings.`
        : null,
    };
  }, [plan, revenueCatPackages.monthly, revenueCatPackages.yearly]);

  if (isChecking || auth.status !== "authenticated" || !showSubscribe) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const activateSubscription = async (customerInfo: any) => {
    if (Object.keys(customerInfo.entitlements.active).length === 0)
      return false;

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data } = await refetchUser();

      if (data?.subscription?.active || data?.parentSubscription?.active) {
        router.replace("/(tabs)/dashboard");
        return true;
      }

      await wait(1000);
    }

    Alert.alert(
      "Subscription syncing",
      "Your purchase was completed and is still syncing. Please try again in a moment."
    );
    return true;
  };

  const restorePurchases = async () => {
    if (restoreLoading) return;

    setRestoreLoading(true);

    try {
      if (user?.uuid) await Purchases.logIn(user.uuid);

      const customerInfo = await Purchases.restorePurchases();
      const restored = await activateSubscription(customerInfo);

      if (!restored) {
        Alert.alert("No purchases found", "No active purchases were found.");
      }
    } catch {
      Alert.alert("Restore failed", "Could not restore purchases.");
    } finally {
      setRestoreLoading(false);
    }
  };

  const purchase = async () => {
    if (!selectedPlan.package || purchaseLoading || !user?.uuid) return;

    setPurchaseLoading(true);

    try {
      const serverReachable = await ensureCloudIsReachable(auth.instance);
      if (!serverReachable) return;

      await Purchases.logIn(user.uuid);
      if (user.email) await Purchases.setEmail(user.email);
      await Purchases.invalidateCustomerInfoCache();

      const existingCustomerInfo = await Purchases.getCustomerInfo();
      const alreadySubscribed =
        await activateSubscription(existingCustomerInfo);

      if (alreadySubscribed) return;

      const { customerInfo, transaction } = await Purchases.purchasePackage(
        selectedPlan.package
      );
      await activateSubscription(customerInfo);

      // Android only: persist the Google Play purchase token (null on iOS). Fire-and-forget
      // after activation, by which point the subscription row exists server-side.
      if (transaction?.purchaseToken) {
        saveGooglePurchaseToken(auth, transaction.purchaseToken);
      }
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert("Purchase failed", "Could not complete purchase.");
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-zinc-100 dark:bg-zinc-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: insets.top + 8,
          paddingBottom: 16,
        }}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center px-6 pt-2 pb-1">
          <Image
            source={require("@/assets/images/linkwarden.png")}
            className="w-[60px] h-[60px]"
          />
          <Text className="text-base-content text-3xl font-bold text-center mt-5">
            Get Linkwarden Cloud
          </Text>
          <Text className="text-neutral text-lg text-center mt-2">
            Collect, read, annotate, and fully preserve what matters, all in one
            place.
          </Text>
        </View>

        <View className="mx-4 mt-6 px-5 py-5 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <View key={feature.title} className="flex-row items-center gap-3">
                <Icon size={20} color={accentColor} strokeWidth={2.5} />
                <Text className="text-base-content text-lg">
                  {feature.title}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <SafeAreaView
        edges={["bottom"]}
        className="bg-zinc-100 dark:bg-zinc-900 px-4 pt-5 pb-2"
      >
        <View className="flex-row gap-3">
          {planCards.map((card) => {
            const isSelected = plan === card.key;
            const showBadge = card.key === Plan.yearly && savingsPercent;

            return (
              // The card is rounded (clips overflow), so the badge lives on an
              // unclipped wrapper and overlaps the card from outside.
              <View key={card.label} className="flex-1">
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setPlan(card.key)}
                  className="rounded-2xl border-2 bg-base-100 p-4"
                  style={{
                    borderColor: isSelected
                      ? accentColor
                      : theme["neutral-content"],
                  }}
                >
                  <View className="flex-row items-start justify-between">
                    <Text className="text-base-content text-lg font-bold">
                      {card.label}
                    </Text>
                    {isSelected ? (
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-accent">
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : (
                      <View className="h-6 w-6 rounded-full border-2 border-neutral-content" />
                    )}
                  </View>

                  {card.price ? (
                    <Text className="text-base-content text-xl font-bold mt-1">
                      {card.price}
                      <Text className="text-neutral text-sm font-normal">
                        {card.suffix}
                      </Text>
                    </Text>
                  ) : (
                    <View className="h-6 w-20 rounded-md bg-base-200 mt-1" />
                  )}

                  {card.caption ? (
                    <Text className="text-neutral text-xs mt-1">
                      {card.caption}
                    </Text>
                  ) : (
                    <View className="h-3 w-16 rounded bg-base-200 mt-2" />
                  )}
                </TouchableOpacity>

                {showBadge ? (
                  <View className="absolute -top-3 left-3 rounded-full bg-accent px-2 py-0.5">
                    <Text className="text-white text-xs font-bold">
                      {savingsPercent}% OFF
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Button
          variant="ghost"
          size="lg"
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={paymentButton.accessibilityLabel}
          className={`w-full flex-row mt-4 px-4 ${payButtonClass}`}
          disabled={!selectedPlan.package || purchaseLoading || !user?.uuid}
          onPress={purchase}
          isLoading={purchaseLoading}
        >
          {paymentButton.icon ? (
            <FontAwesome5
              brand
              name={paymentButton.icon}
              size={paymentButton.iconSize}
              color={payContentColor}
            />
          ) : (
            <Text
              className="text-xl font-semibold"
              style={{ color: payContentColor }}
            >
              {paymentButton.label}
            </Text>
          )}
        </Button>

        {selectedPlan.footnote ? (
          <Text className="text-neutral text-center text-xs mt-3">
            {selectedPlan.footnote}
          </Text>
        ) : null}

        <View className="flex-row items-center justify-center gap-6 mt-3">
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={restoreLoading}
            onPress={restorePurchases}
          >
            {restoreLoading ? (
              <ActivityIndicator color={theme.primary} size="small" />
            ) : (
              <Text className="text-primary text-sm font-semibold">
                Restore Purchases
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL("https://linkwarden.app/tos")}
          >
            <Text className="text-primary text-sm font-semibold">Terms</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              Linking.openURL("https://linkwarden.app/privacy-policy")
            }
          >
            <Text className="text-primary text-sm font-semibold">Privacy</Text>
          </TouchableOpacity>
        </View>

        {isForcedSubscribe ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <TouchableOpacity
                activeOpacity={0.7}
                className="self-center mt-3 flex-row items-center gap-1"
              >
                <Text className="text-neutral text-center text-sm font-semibold">
                  Manage your account
                </Text>
                <ChevronDown size={15} color={theme["neutral"]} />
              </TouchableOpacity>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content>
              {Platform.OS === "ios" /* Reverse order for iOS */ ? (
                <>
                  <DropdownMenu.Item
                    key="delete-account"
                    destructive
                    onSelect={() => SheetManager.show("delete-account-sheet")}
                  >
                    <DropdownMenu.ItemTitle>
                      Delete account
                    </DropdownMenu.ItemTitle>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item key="sign-out" onSelect={() => signOut()}>
                    <DropdownMenu.ItemTitle>Sign out</DropdownMenu.ItemTitle>
                  </DropdownMenu.Item>
                </>
              ) : (
                <>
                  <DropdownMenu.Item key="sign-out" onSelect={() => signOut()}>
                    <DropdownMenu.ItemTitle>Sign out</DropdownMenu.ItemTitle>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    key="delete-account"
                    destructive
                    onSelect={() => SheetManager.show("delete-account-sheet")}
                  >
                    <DropdownMenu.ItemTitle>
                      Delete account
                    </DropdownMenu.ItemTitle>
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            className="self-center mt-3"
            onPress={() => router.replace("/(tabs)/dashboard")}
          >
            <Text className="text-neutral text-center text-sm font-semibold">
              Subscribe Later
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Need help?"
        className="absolute right-4 items-center justify-center rounded-full"
        style={{ top: insets.top + 4 }}
        onPress={() => SheetManager.show("support-sheet")}
      >
        <CircleHelp size={25} color={theme["base-content"]} />
      </TouchableOpacity>
    </View>
  );
}
