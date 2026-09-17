import { Stack } from "expo-router";

import { I18nProvider } from "@/prototype/i18n";

export default function PrototypeLayout() {
  return (
    <I18nProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </I18nProvider>
  );
}
