import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";

import { NewRequestForm } from "@/components/requests/new-request-form";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** A page sheet on the root stack, outside the shell's query layer, so it hands the one client in. */
export default function NewRequestScreen() {
  const route = useRootRoute();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const orphaned = useShellUnderneath({
    pathname: "/requests/new",
    params: date ? { date } : {},
  });

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <NewRequestForm day={date} />
    </QueryClientProvider>
  );
}
