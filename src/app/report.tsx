import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import { ReportScreen } from "@/components/report/report-screen";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** Pushed over the shell from the More sheet, outside its query layer. */
export default function ReportRoute() {
  const route = useRootRoute();
  const orphaned = useShellUnderneath("/report");

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ReportScreen />
    </QueryClientProvider>
  );
}
