import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Text,
  View,
} from "react-native";
import ActionSheet, { SheetManager } from "react-native-actions-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import {
  isAtLeastInstanceVersion,
  type Config,
} from "@linkwarden/router/config";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { rawTheme, ThemeName } from "@/lib/colors";
import useAuthStore from "@/store/auth";
import SheetHeader from "./SheetHeader";

const cloudInstance = "https://cloud.linkwarden.app";

const cloudConfig: Config = {
  DISABLE_REGISTRATION: null,
  ADMIN: null,
  RSS_POLLING_INTERVAL_MINUTES: null,
  EMAIL_PROVIDER: true,
  MAX_FILE_BUFFER: null,
  USER_CONTENT_DOMAIN: null,
  AI_ENABLED: null,
  INSTANCE_VERSION: null,
  STRIPE_ENABLED: null,
  TRIAL_PERIOD_DAYS: null,
  REQUIRE_CC: null,
};

const cleanInstance = (instance: string) => instance.trim().replace(/\/+$/, "");

const timeout = () =>
  new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), 30000)
  );

export default function SignUpSheet() {
  const { auth, signUp, requestVerificationEmail, setInstance } =
    useAuthStore();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const theme = rawTheme[colorScheme as ThemeName];
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [configInstance, setConfigInstance] = useState("");
  const [configError, setConfigError] = useState("");
  const [sentTo, setSentTo] = useState<{
    email: string;
    instance: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    passwordConfirmation: "",
    instance: auth.instance || cloudInstance,
  });

  const instance = cleanInstance(form.instance);
  const currentConfig =
    instance === cloudInstance
      ? cloudConfig
      : configInstance === instance
        ? config
        : null;
  const emailSignUp = currentConfig?.EMAIL_PROVIDER === true;
  const supportsMobileSignup =
    instance === cloudInstance ||
    isAtLeastInstanceVersion(currentConfig?.INSTANCE_VERSION, "v2.15.0");
  const instanceName =
    instance === cloudInstance ? "cloud.linkwarden.app" : instance;

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      instance: auth.instance || cloudInstance,
    }));
  }, [auth.instance]);

  useEffect(() => {
    let active = true;

    if (!instance) {
      setConfig(null);
      setConfigInstance("");
      setConfigError("");
      setIsConfigLoading(false);
      return;
    }

    if (instance === cloudInstance) {
      setConfig(null);
      setConfigInstance("");
      setConfigError("");
      setIsConfigLoading(false);
      return;
    }

    setConfig(null);
    setConfigError("");
    setIsConfigLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await Promise.race([
          fetch(`${instance}/api/v1/config`),
          timeout(),
        ]);
        const data = await res.json().catch(() => null);

        if (!active) return;

        if (res.ok) {
          const nextConfig = data.response as Config;

          if (
            nextConfig.EMAIL_PROVIDER === true &&
            !isAtLeastInstanceVersion(nextConfig.INSTANCE_VERSION, "v2.15.0")
          ) {
            const reset = () => {
              void setInstance(cloudInstance);
            };

            Alert.alert(
              "Sign up through the web",
              "This instance needs to be updated to support mobile sign-up. You can sign up through the web, then come back here to log in.",
              [{ text: "OK", onPress: reset }],
              { onDismiss: reset }
            );
          }

          setConfig(nextConfig);
          setConfigInstance(instance);
        } else {
          setConfigError("Could not load this instance.");
        }
      } catch {
        if (active) setConfigError("Could not reach this instance.");
      } finally {
        if (active) setIsConfigLoading(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [instance]);

  const closeSheet = () => {
    void SheetManager.hide("sign-up-sheet");
  };

  const register = async () => {
    const email = form.email.toLowerCase().trim();
    const username = form.username.toLowerCase().trim();
    const name = form.name.trim();

    if (!currentConfig)
      return Alert.alert("Error", configError || "Please check the instance.");
    else if (currentConfig.DISABLE_REGISTRATION)
      return Alert.alert("Error", "Registration is disabled on this instance.");
    else if (emailSignUp && !supportsMobileSignup)
      return Alert.alert(
        "Sign up through the web",
        "This instance needs to be updated to support mobile sign-up. You can sign up through the web, then come back here to log in."
      );
    else if (
      !name ||
      !form.password ||
      !form.passwordConfirmation ||
      (emailSignUp ? !email : !username)
    )
      return Alert.alert("Error", "Please fill all fields");
    else if (form.password !== form.passwordConfirmation)
      return Alert.alert("Error", "Passwords don't match");
    else if (form.password.length < 8)
      return Alert.alert("Error", "Password must be at least 8 characters");

    setIsLoading(true);
    const created = await signUp({
      name,
      email: emailSignUp ? email : undefined,
      username: emailSignUp ? undefined : username,
      password: form.password,
      instance,
    });
    setIsLoading(false);

    if (!created) return;

    if (emailSignUp) setSentTo({ email, instance });
    else {
      Alert.alert("Account created", "You can log in now.");
    }
  };

  return (
    <ActionSheet
      gestureEnabled
      indicatorStyle={{
        display: "none",
      }}
      containerStyle={{
        backgroundColor: theme["base-100"],
      }}
      safeAreaInsets={insets}
    >
      <SheetHeader
        title={sentTo ? "Check Email" : "Sign Up"}
        onClose={closeSheet}
        titleClassName="text-2xl"
        align="left"
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{
          maxHeight: Dimensions.get("window").height * 0.78,
        }}
        contentContainerClassName="px-8 pb-5 flex-col gap-3"
      >
        {sentTo ? (
          <>
            <Text className="text-base-content text-xl" numberOfLines={1}>
              {sentTo.email}
            </Text>
            <Text className="text-base-content text-center text-base px-2">
              We sent you a verification link. After verifying your email, come
              back and log in.
            </Text>
            <Button
              variant="accent"
              size="lg"
              isLoading={isLoading}
              onPress={async () => {
                setIsLoading(true);
                await requestVerificationEmail(sentTo.email, sentTo.instance);
                setIsLoading(false);
              }}
            >
              <Text className="text-white text-xl">Resend Email</Text>
            </Button>
          </>
        ) : (
          <>
            {!!configError && (
              <Text className="text-red-500 text-center">{configError}</Text>
            )}
            {currentConfig?.DISABLE_REGISTRATION && (
              <Text className="text-neutral text-center">
                Registration is disabled on this instance.
              </Text>
            )}
            {currentConfig?.EMAIL_PROVIDER === true &&
              !supportsMobileSignup && (
                <Text className="text-neutral text-center">
                  This instance needs to be updated to support mobile sign-up.
                  You can sign up through the web, then come back here to log
                  in.
                </Text>
              )}
            <Input
              className="w-full text-xl p-3 leading-tight h-12"
              textAlignVertical="center"
              placeholder="Display Name"
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
            />
            {emailSignUp ? (
              <Input
                className="w-full text-xl p-3 leading-tight h-12"
                textAlignVertical="center"
                placeholder="Email"
                value={form.email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(text) => setForm({ ...form, email: text })}
              />
            ) : (
              <Input
                className="w-full text-xl p-3 leading-tight h-12"
                textAlignVertical="center"
                placeholder="Username"
                value={form.username}
                autoCapitalize="none"
                onChangeText={(text) => setForm({ ...form, username: text })}
              />
            )}
            <Input
              className="w-full text-xl p-3 leading-tight h-12"
              textAlignVertical="center"
              placeholder="Password"
              secureTextEntry
              value={form.password}
              onChangeText={(text) => setForm({ ...form, password: text })}
            />
            <Input
              className="w-full text-xl p-3 leading-tight h-12"
              textAlignVertical="center"
              placeholder="Confirm Password"
              secureTextEntry
              value={form.passwordConfirmation}
              onChangeText={(text) =>
                setForm({ ...form, passwordConfirmation: text })
              }
            />
            <Button
              variant="accent"
              size="lg"
              disabled={isConfigLoading}
              isLoading={isLoading}
              onPress={register}
            >
              <Text className="text-white text-xl">Sign Up</Text>
            </Button>
          </>
        )}
      </ScrollView>
    </ActionSheet>
  );
}
