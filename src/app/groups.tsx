import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import { GroupsList } from "@/components/groups/groups-list";
import { useStoreOpen } from "@/lib/local-store";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** Pushed over the shell from More, outside its query layer, so it hands the one client in. */
export default function GroupsScreen() {
  const route = useRootRoute();
  const orphaned = useShellUnderneath("/groups");
  const storeOpen = useStoreOpen();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned || !storeOpen) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GroupsList />
    </QueryClientProvider>
  );
}
