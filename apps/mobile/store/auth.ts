import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { MobileAuth } from "@linkwarden/types/global";
import { Alert } from "react-native";
import { queryClient } from "@/lib/queryClient";
import { mmkvPersister } from "@/lib/queryPersister";
import { clearCache } from "@/lib/cache";
import useDataStore from "@/store/data";
import { useOfflineSyncStore } from "@/lib/offlineSync";

const cloudInstance = "https://cloud.linkwarden.app";

type SignUpForm = {
  name: string;
  username?: string;
  email?: string;
  password: string;
  instance: string;
};

type AuthStore = {
  auth: MobileAuth;
  signIn: (
    username: string,
    password: string,
    instance: string,
    token?: string
  ) => Promise<void>;
  signUp: (form: SignUpForm) => Promise<boolean>;
  requestVerificationEmail: (
    email: string,
    instance: string
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  setAuth: () => Promise<void>;
};

const timeout = () =>
  new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), 30000)
  );

const requestVerificationEmail = async (email: string, instance: string) => {
  try {
    const res = await Promise.race([
      fetch(`${instance}/api/v1/auth/request-verification-email`, {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      }),
      timeout(),
    ]);
    const data = await res.json().catch(() => null);

    if (res.ok) return true;

    Alert.alert("Error", data?.response || "Could not send verification email");
    return false;
  } catch (err: any) {
    Alert.alert(
      err?.message === "TIMEOUT" ? "Request timed out" : "Network error",
      err?.message === "TIMEOUT"
        ? "Unable to reach the server in time. Please check your network configuration and try again."
        : "Could not connect to the server. Please check your network configuration and try again."
    );
    return false;
  }
};

const useAuthStore = create<AuthStore>((set) => ({
  auth: {
    instance: "",
    session: null,
    status: "loading" as const,
  },
  setAuth: async () => {
    const session = await SecureStore.getItemAsync("TOKEN");
    const instance = await SecureStore.getItemAsync("INSTANCE");

    if (session) {
      set({
        auth: {
          instance,
          session,
          status: "authenticated",
        },
      });
    } else {
      set({
        auth: {
          instance: instance || cloudInstance,
          session: null,
          status: "unauthenticated",
        },
      });
    }
  },
  requestVerificationEmail,
  signUp: async ({ name, username, email, password, instance }) => {
    try {
      const res = await Promise.race([
        fetch(`${instance}/api/v1/users`, {
          method: "POST",
          body: JSON.stringify({
            name,
            username,
            email,
            password,
            acceptPromotionalEmails: false,
          }),
          headers: { "Content-Type": "application/json" },
        }),
        timeout(),
      ]);
      const data = await res.json().catch(() => null);

      if (res.ok) {
        return email ? await requestVerificationEmail(email, instance) : true;
      }

      Alert.alert("Error", data?.response || "Could not create account");
      return false;
    } catch (err: any) {
      Alert.alert(
        err?.message === "TIMEOUT" ? "Request timed out" : "Network error",
        err?.message === "TIMEOUT"
          ? "Unable to reach the server in time. Please check your network configuration and try again."
          : "Could not connect to the server. Please check your network configuration and try again."
      );
      return false;
    }
  },
  signIn: async (username, password, instance, token) => {
    if (process.env.EXPO_PUBLIC_SHOW_LOGS === "true")
      console.log("Signing into", instance);

    if (token) {
      try {
        // make a request to the API to validate the token
        const res = await Promise.race([
          fetch(instance + "/api/v1/users/me", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), 30000)
          ),
        ]);

        if (res.ok) {
          await SecureStore.setItemAsync("INSTANCE", instance);
          await SecureStore.setItemAsync("TOKEN", token);
          set({
            auth: {
              session: token,
              instance,
              status: "authenticated",
            },
          });
          router.replace("/(tabs)/dashboard");
        } else {
          Alert.alert("Error", "Invalid token");
        }
      } catch (err: any) {
        if (err?.message === "TIMEOUT") {
          Alert.alert(
            "Request timed out",
            "Unable to reach the server in time. Please check your network configuration and try again."
          );
        } else {
          Alert.alert(
            "Network error",
            "Could not connect to the server. Please check your network configuration and try again."
          );
        }
      }
    } else {
      try {
        const res = await Promise.race([
          fetch(`${instance}/api/v1/session`, {
            method: "POST",
            body: JSON.stringify({ username, password }),
            headers: { "Content-Type": "application/json" },
          }),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), 30000)
          ),
        ]);

        if (res.ok) {
          const data = await res.json();
          const session = (data as any).response.token;

          await SecureStore.setItemAsync("TOKEN", session);
          await SecureStore.setItemAsync("INSTANCE", instance);
          set({ auth: { session, instance, status: "authenticated" } });
          router.replace("/(tabs)/dashboard");
        } else {
          Alert.alert("Error", "Invalid credentials");
        }
      } catch (err: any) {
        if (err?.message === "TIMEOUT") {
          Alert.alert(
            "Request timed out",
            "Unable to reach the server in time. Please check your network configuration and try again."
          );
        } else {
          Alert.alert(
            "Network error",
            "Could not connect to the server. Please check your network configuration and try again."
          );
        }
      }
    }
  },
  signOut: async () => {
    await SecureStore.deleteItemAsync("TOKEN");
    await SecureStore.deleteItemAsync("INSTANCE");

    queryClient.cancelQueries();
    queryClient.clear();
    mmkvPersister.removeClient?.();

    await clearCache();

    useDataStore.getState().updateData({ offlineEnabled: false });
    useOfflineSyncStore.getState().reset();

    set({
      auth: {
        instance: "",
        session: null,
        status: "unauthenticated",
      },
    });

    router.replace("/");
  },
}));

export default useAuthStore;
