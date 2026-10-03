import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";

import { JoinSheet } from "@/components/groups-prototype/join-sheet";
import { useTone } from "@/components/ui/icon";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

export default function Screen() {
  const route = useRootRoute();
  const card = useTone("card");
  const orphaned = useShellUnderneath("/groups/join");
  const { state } = useLocalSearchParams<{ state?: string }>();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack.Screen options={{ contentStyle: { backgroundColor: card } }} />
      <JoinSheet key={state ?? "live"} />
    </QueryClientProvider>
  );
}
