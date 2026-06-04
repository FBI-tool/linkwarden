import { Button } from "@/components/ui/Button";
import { rawTheme, ThemeName } from "@/lib/colors";
import {
  hasInactiveSubscription,
  shouldRouteToSubscribe,
} from "@/lib/subscription";
import useAuthStore from "@/store/auth";
import { useConfig } from "@linkwarden/router/config";
import { useUser } from "@linkwarden/router/user";
import { Plan } from "@linkwarden/types/global";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const screenWidth = Dimensions.get("screen").width;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const selectedPlan = useMemo(() => {
    const isMonthly = plan === Plan.monthly;
    const selectedPackage = isMonthly
      ? revenueCatPackages.monthly
      : revenueCatPackages.yearly;
    const selectedProduct = selectedPackage?.product;
    const totalPrice = selectedProduct?.priceString;
    const monthlyPrice = isMonthly
      ? totalPrice
      : selectedProduct?.pricePerMonthString;
    const freeTrialPeriod = getFreeTrialPeriod(selectedProduct);

    return {
      package: selectedPackage ?? null,
      price: monthlyPrice ?? null,
      billed: isMonthly ? "Billed monthly" : "Billed yearly",
      total: totalPrice
        ? freeTrialPeriod
          ? `After ${freeTrialPeriod}: ${
              isMonthly ? `${totalPrice} per month` : `${totalPrice} per year`
            }.`
          : `${
              isMonthly ? `${totalPrice} per month` : `${totalPrice} per year`
            }.`
        : null,
      trialText: selectedProduct
        ? freeTrialPeriod
          ? `Start with a ${freeTrialPeriod} free trial, cancel anytime.`
          : "Subscribe to continue."
        : null,
    };
  }, [plan, revenueCatPackages.monthly, revenueCatPackages.yearly]);

  if (isChecking || auth.status !== "authenticated" || !showSubscribe) {
    return (
      <View className="flex-1 items-center justify-center bg-base-100">
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
      await Purchases.logIn(user.uuid);
      await Purchases.invalidateCustomerInfoCache();

      const existingCustomerInfo = await Purchases.getCustomerInfo();
      const alreadySubscribed =
        await activateSubscription(existingCustomerInfo);

      if (alreadySubscribed) return;

      const { customerInfo } = await Purchases.purchasePackage(
        selectedPlan.package
      );
      await activateSubscription(customerInfo);
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert("Purchase failed", "Could not complete purchase.");
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <ScrollView
      className="bg-primary"
      contentContainerStyle={{ flexGrow: 1 }}
      bounces={false}
    >
      <View className="flex-1 justify-end bg-primary">
        <SafeAreaView edges={["top"]} className="flex-1 justify-center px-8">
          <Image
            source={require("@/assets/images/linkwarden.png")}
            className="w-[104px] h-[104px]"
          />
          <Text className="text-base-100 text-5xl font-bold mt-8">
            Subscribe
          </Text>
          {selectedPlan.trialText ? (
            <Text className="text-base-100 text-2xl mt-3">
              {selectedPlan.trialText}
            </Text>
          ) : (
            <View className="h-7 w-4/5 rounded-md bg-base-100/30 mt-3" />
          )}
        </SafeAreaView>

        <Svg
          viewBox="0 0 1440 320"
          width={screenWidth}
          height={screenWidth * (320 / 1440) + 2}
        >
          <Path
            fill={rawTheme[colorScheme as ThemeName]["base-100"]}
            fillOpacity="1"
            d="M0,256L48,234.7C96,213,192,171,288,176C384,181,480,235,576,266.7C672,299,768,309,864,277.3C960,245,1056,171,1152,122.7C1248,75,1344,53,1392,42.7L1440,32L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </Svg>

        <SafeAreaView
          edges={["bottom"]}
          className="bg-base-100 -mt-2 px-4 pt-8 pb-8 gap-5"
        >
          <Text className="text-base-content text-base">
            Subscribe to start using Linkwarden. If you think this is a mistake,
            contact support@linkwarden.app.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            className="self-start"
            disabled={restoreLoading}
            onPress={restorePurchases}
          >
            {restoreLoading ? (
              <ActivityIndicator
                color={rawTheme[colorScheme as ThemeName].primary}
                size="small"
              />
            ) : (
              <Text className="text-primary font-semibold">
                Restore Purchases
              </Text>
            )}
          </TouchableOpacity>

          <View className="bg-base-200 border border-neutral-content rounded-lg p-1 flex-row relative">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setPlan(Plan.monthly)}
              className={`flex-1 items-center rounded-md py-2 ${
                plan === Plan.monthly ? "bg-primary" : ""
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  plan === Plan.monthly ? "text-base-100" : "text-base-content"
                }`}
              >
                Monthly
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setPlan(Plan.yearly)}
              className={`flex-1 items-center rounded-md py-2 ${
                plan === Plan.yearly ? "bg-primary" : ""
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  plan === Plan.yearly ? "text-base-100" : "text-base-content"
                }`}
              >
                Yearly
              </Text>
            </TouchableOpacity>
          </View>

          <View className="items-center gap-1">
            {selectedPlan.price ? (
              <Text className="text-base-content text-4xl font-semibold">
                {selectedPlan.price}
                <Text className="text-neutral text-base font-normal">/mo</Text>
              </Text>
            ) : (
              <View className="h-10 w-28 rounded-md bg-base-200" />
            )}
            <Text className="text-base-content text-base font-semibold">
              {selectedPlan.billed}
            </Text>
          </View>

          <View className="border border-neutral-content rounded-lg p-3">
            <Text className="text-base-content text-sm font-semibold mb-1">
              Total
            </Text>
            {selectedPlan.total ? (
              <Text className="text-neutral text-sm">{selectedPlan.total}</Text>
            ) : (
              <View className="h-4 w-4/5 rounded bg-base-200" />
            )}
          </View>

          <Button
            variant="ghost"
            size="lg"
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={paymentButton.accessibilityLabel}
            className="w-full flex-row bg-black px-4"
            disabled={!selectedPlan.package || purchaseLoading || !user?.uuid}
            onPress={purchase}
            isLoading={purchaseLoading}
          >
            {paymentButton.icon ? (
              <FontAwesome5
                brand
                name={paymentButton.icon}
                size={paymentButton.iconSize}
                color="white"
              />
            ) : (
              <Text className="text-xl font-semibold text-white">
                {paymentButton.label}
              </Text>
            )}
          </Button>

          {isForcedSubscribe ? (
            <TouchableOpacity className="w-fit mx-auto" onPress={signOut}>
              <Text className="text-neutral text-center w-fit font-semibold">
                Sign out
              </Text>
            </TouchableOpacity>
          ) : (
            <Button
              variant="metal"
              size="lg"
              onPress={() => router.replace("/(tabs)/dashboard")}
            >
              <Text className="text-base-content text-xl">Subscribe Later</Text>
            </Button>
          )}
        </SafeAreaView>
      </View>
    </ScrollView>
  );
}
