import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";

import { JoinSheet } from "@/components/groups/join-sheet";
import { useTone } from "@/components/ui/icon";
import { useStoreOpen } from "@/lib/local-store";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** The Join sheet: a formSheet on the root stack, outside the shell's query layer. */
export default function JoinSheetScreen() {
  const route = useRootRoute();
  // Without it iOS 26 paints a glass strip under the floating sheet's content.
  const card = useTone("card");
  const orphaned = useShellUnderneath("/groups/join");
  const storeOpen = useStoreOpen();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned || !storeOpen) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack.Screen options={{ contentStyle: { backgroundColor: card } }} />
      <JoinSheet />
    </QueryClientProvider>
  );
}
