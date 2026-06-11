import { Button } from "@/components/ui/Button";
import { rawTheme, ThemeName } from "@/lib/colors";
import useAuthStore from "@/store/auth";
import { isAtLeastInstanceVersion } from "@linkwarden/router/config";
import { FontAwesome } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { ChevronDown, CircleHelp } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import {
  Dimensions,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import Svg, { Path } from "react-native-svg";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardToolbar } from "react-native-keyboard-controller";
import * as DropdownMenu from "zeego/dropdown-menu";

const cloudInstance = "https://cloud.linkwarden.app";

const displayInstance = (instance: string | null | undefined) =>
  (instance || cloudInstance).replace(/^https?:\/\//, "").replace(/\/+$/, "");

export default function HomeScreen() {
  const {
    auth,
    instanceInfo,
    setInstance,
    fetchInstanceInfo,
    signInWithApple,
    signInWithGoogle,
  } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const theme = rawTheme[colorScheme as ThemeName];
  const serverName = displayInstance(auth.instance);
  const instance = (auth.instance || cloudInstance).trim().replace(/\/+$/, "");
  const currentInstanceInfo =
    instanceInfo.instance === instance ? instanceInfo : null;
  const buttonAuths = currentInstanceInfo?.logins?.buttonAuths;
  const versionOk = currentInstanceInfo?.config
    ? isAtLeastInstanceVersion(
        currentInstanceInfo.config.INSTANCE_VERSION,
        "v2.15.0"
      )
    : instance === cloudInstance;
  const hasApple = buttonAuths
    ? buttonAuths.some((button) => button.method === "apple")
    : instance === cloudInstance;
  const hasGoogle = buttonAuths
    ? buttonAuths.some((button) => button.method === "google")
    : instance === cloudInstance;
  const appleEnabled = Platform.OS === "ios" && hasApple && versionOk;
  const googleEnabled = hasGoogle && versionOk;
  const isCheckingOAuth =
    currentInstanceInfo?.status === "loading" && !buttonAuths;

  const openLoginSheet = () => {
    SheetManager.show("login-sheet");
  };

  const openSignUpSheet = () => {
    SheetManager.show("sign-up-sheet");
  };

  const setCloudServer = () => {
    setInstance(cloudInstance);
  };

  const openSelfHostedSheet = () => {
    requestAnimationFrame(() => {
      SheetManager.show("self-hosted-server-sheet");
    });
  };

  const serverOptions = [
    {
      key: "cloud",
      title: "Cloud (Default)",
      onSelect: setCloudServer,
      className: "font-bold",
    },
    {
      key: "self-hosted",
      title: "Self-hosted",
      onSelect: openSelfHostedSheet,
    },
  ];
  const orderedServerOptions =
    Platform.OS === "ios" ? [...serverOptions].reverse() : serverOptions;
  const ssoProviderText =
    appleEnabled && googleEnabled
      ? "Apple or Google"
      : appleEnabled
        ? "Apple"
        : "Google";

  useEffect(() => {
    fetchInstanceInfo(instance);
  }, [fetchInstanceInfo, instance]);

  if (auth.session) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <>
      <Animated.View entering={FadeIn} className="flex-col justify-end h-full">
        <View className="h-full bg-sky-50 dark:bg-sky-950">
          <SafeAreaView className="flex-col justify-between h-full duration-100 pt-10 -mt-2 w-full px-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center justify-center gap-4">
                <Image
                  source={require("@/assets/images/linkwarden.png")}
                  className="w-[40px] h-[40px]"
                />
                <Text className="text-base-content text-3xl font-semibold">
                  Linkwarden
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Need help?"
                className="items-center justify-center rounded-full"
                onPress={() => SheetManager.show("support-sheet")}
              >
                <CircleHelp size={25} color={theme["base-content"]} />
              </TouchableOpacity>
            </View>

            <View className="flex-col gap-4">
              <View className="flex-row gap-3">
                <Button
                  variant="accent"
                  size="lg"
                  className="flex-1 px-4"
                  onPress={openSignUpSheet}
                >
                  <Text className="text-white text-xl">Sign Up</Text>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 px-4 bg-base-100"
                  onPress={openLoginSheet}
                  activeOpacity={0.7}
                >
                  <Text className="text-base-content text-xl">Login</Text>
                </Button>
              </View>

              {(appleEnabled || googleEnabled) && (
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1 flex-col">
                    <Text className="text-neutral">Or continue using</Text>
                    <Text className="font-bold text-base-content">
                      {ssoProviderText}
                    </Text>
                  </View>
                  <View className="flex-row justify-end gap-3">
                    {appleEnabled && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Continue with Apple"
                        className="h-12 w-12 items-center justify-center rounded-lg border border-base-content bg-base-100"
                        disabled={isCheckingOAuth}
                        onPress={() => {
                          if (isCheckingOAuth) return;
                          signInWithApple(instance);
                        }}
                      >
                        <FontAwesome
                          name="apple"
                          size={22}
                          color={theme["base-content"]}
                        />
                      </TouchableOpacity>
                    )}
                    {googleEnabled && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Continue with Google"
                        className="h-12 w-12 items-center justify-center rounded-lg border border-base-content bg-base-100"
                        disabled={isCheckingOAuth}
                        onPress={() => {
                          if (isCheckingOAuth) return;
                          signInWithGoogle(instance);
                        }}
                      >
                        <FontAwesome
                          name="google"
                          size={20}
                          color={theme["base-content"]}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              <View className="flex-row items-center justify-center gap-1 mt-5">
                <Text className="text-neutral text-xs">Hosted on:</Text>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Server: ${serverName}`}
                      className="flex-row items-center justify-center gap-1"
                    >
                      <Text className="text-primary text-xs">{serverName}</Text>
                      <ChevronDown size={12} color={theme["primary"]} />
                    </TouchableOpacity>
                  </DropdownMenu.Trigger>

                  <DropdownMenu.Content>
                    <DropdownMenu.Separator />
                    {orderedServerOptions.map((option) => (
                      <DropdownMenu.Item
                        key={option.key}
                        onSelect={option.onSelect}
                        className={option.className}
                      >
                        {option.title}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Animated.View>
      <KeyboardToolbar />
    </>
  );
}
