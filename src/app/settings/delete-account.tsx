import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, router, useNavigation } from "expo-router";

import { DeleteAccountSheet } from "@/components/settings/delete-account-sheet";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** A page sheet over Settings, which sits outside the shell's query layer as well. */
export default function Screen() {
  const route = useRootRoute();
  const orphaned = !useNavigation().canGoBack();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return <Redirect href="/dashboard" />;

  return (
    <QueryClientProvider client={queryClient}>
      <DeleteAccountSheet onClose={() => router.back()} />
    </QueryClientProvider>
  );
}
