import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { TranslationProvider } from "@/i18n/use-translation";

export default function RootLayout() {
  return (
    <TranslationProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </TranslationProvider>
  );
}
