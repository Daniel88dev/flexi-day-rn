import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";

import { useStoreGroups } from "@/components/groups-prototype/data";
import { JoinScreen } from "@/components/groups-prototype/join-screen";
import { useStoreOpen } from "@/lib/local-store";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";
import { useViewer } from "@/lib/viewer/use-viewer";

// PROTOTYPE (T-144): outside the shell's signed-out redirect, so a signed-out phone sees the invite.
export default function Screen() {
  const route = useRootRoute();
  const { token = "", state } = useLocalSearchParams<{ token?: string; state?: string }>();
  const orphaned = useShellUnderneath({
    pathname: "/join",
    params: { token, ...(state ? { state } : {}) },
  });
  const storeOpen = useStoreOpen();

  if (route === "signed-in" && (orphaned || !storeOpen)) return null;

  return (
    <QueryClientProvider client={queryClient}>
      {route === "signed-in" ? (
        <SignedIn key={`${token}${state ?? ""}`} token={token} />
      ) : (
        <JoinScreen key={`${token}${state ?? ""}`} token={token} myGroups={[]} />
      )}
    </QueryClientProvider>
  );
}

function SignedIn({ token }: { token: string }) {
  const myGroups = useStoreGroups(useViewer()?.id ?? null);
  return <JoinScreen token={token} myGroups={myGroups} />;
}
