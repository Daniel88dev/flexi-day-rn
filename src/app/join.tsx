import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";

import { JoinScreen } from "@/components/groups/join-screen";
import { useStoreOpen } from "@/lib/local-store";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/**
 * The Join screen, a full-height modal outside `(app)` that `flexiday://join?token=` and the
 * invite email's universal link both open. It hands the one query client in.
 */
export default function JoinScreenRoute() {
  const route = useRootRoute();
  const { token = "" } = useLocalSearchParams<{ token?: string }>();
  const orphaned = useShellUnderneath({ pathname: "/join", params: { token } });
  const storeOpen = useStoreOpen();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned || !storeOpen) return null;

  return (
    <QueryClientProvider client={queryClient}>
      {/* A second link over an open screen starts it over for its own invite. */}
      <JoinScreen key={token} token={token} />
    </QueryClientProvider>
  );
}
