import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { TranslationProvider } from "@/i18n/use-translation";
import { loadDeviceId } from "@/lib/session/device-id";
import { rootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { loadCachedSession, type CachedSession } from "@/lib/session/session-cache";

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
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </TranslationProvider>
    </RootRouteProvider>
  );
}
