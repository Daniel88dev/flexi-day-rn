import { Redirect, router, useNavigation } from "expo-router";

import { ChangePasswordScreen } from "@/components/settings/change-password-screen";
import { useRootRoute } from "@/lib/session/root-route-context";

export default function Screen() {
  const route = useRootRoute();
  const orphaned = !useNavigation().canGoBack();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return <Redirect href="/dashboard" />;

  return <ChangePasswordScreen onDone={() => router.back()} />;
}
