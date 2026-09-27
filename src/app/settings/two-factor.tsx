import { Redirect, router, useLocalSearchParams, useNavigation } from "expo-router";

import { TwoFactorSheet } from "@/components/settings/two-factor-sheet";
import { isTwoFactorFlow } from "@/lib/session/two-factor-settings";
import { useRootRoute } from "@/lib/session/root-route-context";

/** A page sheet over Settings: `flow` is enable, authenticator, backupCodes or disable. */
export default function Screen() {
  const route = useRootRoute();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const orphaned = !useNavigation().canGoBack();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned || !isTwoFactorFlow(flow)) return <Redirect href="/dashboard" />;

  return <TwoFactorSheet flow={flow} onClose={() => router.back()} />;
}
