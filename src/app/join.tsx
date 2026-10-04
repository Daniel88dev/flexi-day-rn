import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";

import { JoinScreen } from "@/components/groups/join-screen";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/**
 * The Join screen, a full-height modal outside `(app)` that `flexiday://join?token=` and the
 * invite email's universal link both open, signed in or out. It hands the one query client in.
 */
export default function JoinScreenRoute() {
  const route = useRootRoute();
  const { token = "" } = useLocalSearchParams<{ token?: string }>();

  return (
    <QueryClientProvider client={queryClient}>
      {/* A second link over an open screen starts it over for its own invite. */}
      <JoinScreen key={token} token={token} signedIn={route === "signed-in"} />
    </QueryClientProvider>
  );
}
