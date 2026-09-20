import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { TranslationProvider } from "@/i18n/use-translation";
import { loadDeviceId } from "@/lib/session/device-id";

export default function RootLayout() {
  const [deviceIdRead, setDeviceIdRead] = useState(false);

  // Every request identifies the phone, so nothing renders until the Device id is in memory.
  // A Keychain that refuses still lets the app run; its requests go out as an unknown client.
  useEffect(() => {
    loadDeviceId()
      .catch((error: unknown) => console.error("The Device id could not be read.", error))
      .finally(() => setDeviceIdRead(true));
  }, []);

  if (!deviceIdRead) return null;

  return (
    <TranslationProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </TranslationProvider>
  );
}
