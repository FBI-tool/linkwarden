import { Button } from "@/components/ui/Button";
import { rawTheme, ThemeName } from "@/lib/colors";
import {
  getSubscriptionDaysLeft,
  getTrialPeriodDays,
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
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

const paymentButton = Platform.select({
  ios: {
    accessibilityLabel: "Subscribe with Apple Pay",
    icon: "apple-pay",
    iconSize: 50,
  },
  android: {
    accessibilityLabel: "Subscribe with Google Pay",
    icon: "google-pay",
    iconSize: 50,
  },
  default: {
    accessibilityLabel: "Complete Subscription",
    iconSize: 0,
    label: "Complete Subscription",
  },
});

export default function SubscribeScreen() {
  const { auth, signOut } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const [plan, setPlan] = useState<Plan>(Plan.yearly);
  const { data: user, isLoading: isUserLoading } = useUser(auth);
  const config = useConfig(auth);

  const trialPeriodDays = getTrialPeriodDays(config.data);
  const daysLeft = getSubscriptionDaysLeft(user?.createdAt, trialPeriodDays);
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

  const selectedPlan = useMemo(() => {
    const isMonthly = plan === Plan.monthly;
    const deferredDays = config.data?.REQUIRE_CC ? trialPeriodDays : daysLeft;

    return {
      price: isMonthly ? "4" : "3",
      billed: isMonthly ? "Billed monthly" : "Billed yearly",
      total:
        deferredDays > 0
          ? `After ${deferredDays} ${deferredDays === 1 ? "day" : "days"}: ${
              isMonthly ? "$4 per month" : "$36 per year"
            }, plus tax.`
          : `${isMonthly ? "$4 per month" : "$36 per year"}, plus tax.`,
    };
  }, [config.data?.REQUIRE_CC, daysLeft, plan, trialPeriodDays]);

  if (isChecking || auth.status !== "authenticated" || !showSubscribe) {
    return (
      <View className="flex-1 items-center justify-center bg-base-100">
        <ActivityIndicator
          size="large"
          color={rawTheme[colorScheme as ThemeName]["base-content"]}
        />
      </View>
    );
  }

  const trialText = config.data?.REQUIRE_CC
    ? `Start with a ${trialPeriodDays}-day free trial, cancel anytime.`
    : daysLeft <= 0
      ? "Your free trial has ended. Subscribe to continue."
      : `You have ${daysLeft} ${
          daysLeft === 1 ? "day" : "days"
        } left in your free trial.`;

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
          <Text className="text-base-100 text-2xl mt-3">{trialText}</Text>
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

            <View
              className="absolute -top-3 right-1 bg-red-600 px-2 py-0.5 rounded-md"
              style={{ transform: [{ rotate: "12deg" }] }}
            >
              <Text className="text-white text-xs font-semibold">25% off</Text>
            </View>
          </View>

          <View className="items-center gap-1">
            <Text className="text-base-content text-4xl font-semibold">
              ${selectedPlan.price}
              <Text className="text-neutral text-base font-normal">/mo</Text>
            </Text>
            <Text className="text-base-content text-base font-semibold">
              {selectedPlan.billed}
            </Text>
          </View>

          <View className="border border-neutral-content rounded-lg p-3">
            <Text className="text-base-content text-sm font-semibold mb-1">
              Total
            </Text>
            <Text className="text-neutral text-sm">{selectedPlan.total}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={paymentButton.accessibilityLabel}
            className="w-full flex-row items-center justify-center rounded-lg bg-black px-4"
            onPress={() => undefined}
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
          </TouchableOpacity>

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
