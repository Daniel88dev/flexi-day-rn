import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";

import { RequestDetail } from "@/components/requests/request-detail";
import { useStoreOpen } from "@/lib/local-store";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** It sits outside the shell's query layer, so it hands the one client in. */
export default function RequestDetailScreen() {
  const route = useRootRoute();
  const { vacationId } = useLocalSearchParams<{ vacationId: string }>();
  const orphaned = useShellUnderneath({
    pathname: "/requests/[vacationId]",
    params: { vacationId },
  });
  const storeOpen = useStoreOpen();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned || !storeOpen) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <RequestDetail vacationId={vacationId} />
    </QueryClientProvider>
  );
}
