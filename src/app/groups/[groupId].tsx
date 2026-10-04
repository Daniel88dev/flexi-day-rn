import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";

import { GroupDetail } from "@/components/groups/group-detail";
import { useStoreOpen } from "@/lib/local-store";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** A card push from Groups, outside the shell's query layer, so it hands the one client in. */
export default function GroupDetailScreen() {
  const route = useRootRoute();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const orphaned = useShellUnderneath({ pathname: "/groups/[groupId]", params: { groupId } });
  const storeOpen = useStoreOpen();

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned || !storeOpen) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GroupDetail groupId={groupId} />
    </QueryClientProvider>
  );
}
