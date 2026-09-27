import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";

import { RequestDetail } from "@/components/requests/request-detail";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** It sits outside the shell's query layer, so it hands the one client in. */
export default function RequestDetailScreen() {
  const route = useRootRoute();
  const { vacationId } = useLocalSearchParams<{ vacationId: string }>();
  const orphaned = !useNavigation().canGoBack();

  // A cold deep link lands here with nothing beneath. The shell goes under it first, which opens
  // the Local store and mounts the query layer the screen writes through.
  useEffect(() => {
    if (route !== "signed-in" || !orphaned) return;
    router.replace("/dashboard");
    router.push({ pathname: "/requests/[vacationId]", params: { vacationId } });
  }, [route, orphaned, vacationId]);

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <RequestDetail vacationId={vacationId} />
    </QueryClientProvider>
  );
}
