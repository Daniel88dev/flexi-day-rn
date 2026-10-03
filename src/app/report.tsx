import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";

import { ReportScreen } from "@/components/report-prototype/overview";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

// PROTOTYPE (T-143, prototype/report).
export default function Screen() {
  const route = useRootRoute();
  const params = useLocalSearchParams<Record<string, string>>();
  const query = new URLSearchParams(params).toString();
  const orphaned = useShellUnderneath(query ? `/report?${query}` : "/report");

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ReportScreen />
    </QueryClientProvider>
  );
}
