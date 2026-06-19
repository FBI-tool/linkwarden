import { useRouter } from "expo-router";
import {
  NativeTabs,
  Icon,
  Label,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useColorScheme } from "nativewind";
import { rawTheme, ThemeName } from "@/lib/colors";
import useAuthStore from "@/store/auth";
import { useUser } from "@linkwarden/router/user";
import { useConfig } from "@linkwarden/router/config";
import { shouldRouteToSubscribe } from "@/lib/subscription";

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const { auth } = useAuthStore();
  const { data: user, isLoading: isUserLoading } = useUser(auth);
  const config = useConfig(auth);
  const routeToSubscribe = shouldRouteToSubscribe(user, config.data);

  useEffect(() => {
    if (routeToSubscribe) router.replace("/subscribe");
  }, [routeToSubscribe, router]);

  if (
    auth.status === "authenticated" &&
    (isUserLoading || config.isLoading || routeToSubscribe)
  ) {
    return (
      <View className="flex-1 items-center justify-center bg-base-100">
        <ActivityIndicator
          size="large"
          color={rawTheme[colorScheme as ThemeName]["base-content"]}
        />
      </View>
    );
  }

  return (
    <NativeTabs
      labelVisibilityMode="labeled"
      tintColor={rawTheme[colorScheme as ThemeName].primary}
      backgroundColor={
        Platform.OS === "android"
          ? rawTheme[colorScheme as ThemeName]["base-200"]
          : undefined
      }
      indicatorColor={rawTheme[colorScheme as ThemeName]["neutral-content"]}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="dashboard">
        <Label>Dashboard</Label>
        <Icon
          sf={{ default: "house", selected: "house.fill" }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="links">
        <Label>Links</Label>
        <Icon
          sf="link"
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="link-outline" />,
            selected: <VectorIcon family={Ionicons} name="link" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collections">
        <Label>Collections</Label>
        <Icon
          sf={{ default: "folder", selected: "folder.fill" }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="folder-outline" />,
            selected: <VectorIcon family={Ionicons} name="folder" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tags">
        <Label>Tags</Label>
        <Icon
          sf="number"
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="pricetag-outline" />,
            selected: <VectorIcon family={Ionicons} name="pricetag" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="settings-outline" />,
            selected: <VectorIcon family={Ionicons} name="settings" />,
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
