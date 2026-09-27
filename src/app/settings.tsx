import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useNavigation } from "expo-router";

import { SettingsScreen } from "@/components/settings/settings-screen";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** Pushed over the shell from More, outside its query layer, so it hands the one client in. */
export default function Screen() {
  const route = useRootRoute();
  const orphaned = !useNavigation().canGoBack();

  if (route === "welcome") return <Redirect href="/welcome" />;
  // A cold deep link lands here without the shell beneath, and the shell opens the Local store.
  if (orphaned) return <Redirect href="/dashboard" />;

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsScreen />
    </QueryClientProvider>
  );
}
