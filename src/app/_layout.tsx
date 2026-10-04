import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";

import { TranslationProvider } from "@/i18n/use-translation";
import { loadDeviceId } from "@/lib/session/device-id";
import { rootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { loadCachedSession, type CachedSession } from "@/lib/session/session-cache";

const FORM_SHEET = {
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 28,
} as const;

export default function RootLayout() {
  const [deviceIdRead, setDeviceIdRead] = useState(false);
  const [cachedSession, setCachedSession] = useState<CachedSession | null | undefined>(undefined);

  // Every request identifies the phone, so nothing renders until the Device id is in memory.
  // A Keychain that refuses still lets the app run; its requests go out as an unknown client.
  useEffect(() => {
    loadDeviceId()
      .catch((error: unknown) => console.error("The Device id could not be read.", error))
      .finally(() => setDeviceIdRead(true));
  }, []);

  // The expo client's session cache decides where the launch lands, and it is on the phone, so
  // a signed-in cold start reaches the dashboard without asking the backend first.
  useEffect(() => {
    void loadCachedSession().then(setCachedSession);
  }, []);

  const route = rootRoute({ deviceIdRead, cachedSession });
  if (route === "wait") return null;

  return (
    // sonner-native's toasts need a gesture handler root above them and expo-router mounts none.
    // The Toaster sits after the root stack, so toasts show over root-stack screens too.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootRouteProvider route={route}>
        <TranslationProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="clock" options={FORM_SHEET} />
            <Stack.Screen name="groups/join" options={FORM_SHEET} />
            <Stack.Screen name="join" options={{ presentation: "modal" }} />
            <Stack.Screen name="requests/new" options={{ presentation: "modal" }} />
            <Stack.Screen name="settings/two-factor" options={{ presentation: "modal" }} />
            <Stack.Screen name="settings/delete-account" options={{ presentation: "modal" }} />
            <Stack.Screen name="notifications-intro" options={FORM_SHEET} />
            <Stack.Screen name="my-attendance/entry" options={{ presentation: "modal" }} />
            <Stack.Screen name="my-attendance/session/[id]" options={{ presentation: "modal" }} />
          </Stack>
          <StatusBar style="auto" />
        </TranslationProvider>
      </RootRouteProvider>
      <Toaster />
    </GestureHandlerRootView>
  );
}
