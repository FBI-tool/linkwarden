import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import ActionSheet, { SheetManager } from "react-native-actions-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { rawTheme, ThemeName } from "@/lib/colors";
import useAuthStore from "@/store/auth";
import SheetHeader from "./SheetHeader";

const cloudInstance = "https://cloud.linkwarden.app";

const cleanInstance = (instance: string) => instance.trim().replace(/\/+$/, "");

const normalizeInstance = (instance: string) => {
  const clean = cleanInstance(instance);

  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;

  return `https://${clean}`;
};

const timeout = () =>
  new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), 30000)
  );

export default function SelfHostedServerSheet() {
  const { auth, setInstance } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const theme = rawTheme[colorScheme as ThemeName];
  const [server, setServer] = useState(
    auth.instance && auth.instance !== cloudInstance ? auth.instance : ""
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setServer(
      auth.instance && auth.instance !== cloudInstance ? auth.instance : ""
    );
  }, [auth.instance]);

  const closeSheet = () => {
    void SheetManager.hide("self-hosted-server-sheet");
  };

  const setSelfHostedServer = async () => {
    const instance = normalizeInstance(server);

    if (!instance)
      return Alert.alert("Error", "Please enter a server address.");

    setIsLoading(true);

    try {
      const res = await Promise.race([
        fetch(`${instance}/api/v1/config`),
        timeout(),
      ]);

      if (!res.ok) {
        return Alert.alert("Error", "Could not verify this server.");
      }

      await setInstance(instance);
      closeSheet();
    } catch (err: any) {
      Alert.alert(
        err?.message === "TIMEOUT" ? "Request timed out" : "Network error",
        err?.message === "TIMEOUT"
          ? "Unable to reach the server in time. Please check the address and try again."
          : "Could not connect to the server. Please check the address and try again."
      );
    } finally {
      setIsLoading(false);
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
        title="Self-hosted Server"
        onClose={closeSheet}
        titleClassName="text-2xl"
        align="left"
      />

      <View className="px-8 pb-5 flex-col gap-4">
        <Input
          className="w-full text-xl p-3 leading-tight h-12"
          textAlignVertical="center"
          placeholder="https://example.com"
          selectTextOnFocus={false}
          value={server}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setServer}
        />

        <Button
          variant="accent"
          size="lg"
          isLoading={isLoading}
          onPress={setSelfHostedServer}
        >
          <Text className="text-white text-xl">Set</Text>
        </Button>
      </View>
    </ActionSheet>
  );
}
