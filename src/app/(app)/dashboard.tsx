import { RefreshControl, ScrollView, View } from "react-native";

import { DevelopmentCard } from "@/components/dashboard/development-card";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { Greeting } from "@/components/dashboard/greeting";
import { LastSynced } from "@/components/dashboard/last-synced";
import { SyncingDashboard } from "@/components/dashboard/syncing-dashboard";
import { useTone } from "@/components/ui/icon";
import { useStoreRowCounts, useSyncStatus } from "@/lib/local-store";
import { useRefreshPull } from "@/lib/use-refresh-pull";
import { useViewer } from "@/lib/viewer/use-viewer";

export default function DashboardScreen() {
  const viewer = useViewer();
  const primary = useTone("primary");
  const counts = useStoreRowCounts();
  const { inFlight } = useSyncStatus();
  const { refreshing, refresh } = useRefreshPull();

  const empty = Object.values(counts).every((rows) => rows === 0);

  return (
    <ScrollView
      testID="dashboard"
      className="flex-1 bg-background pt-safe"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={refresh} />
      }
    >
      <View className="gap-5 px-4 pt-3">
        <Greeting viewer={viewer} />
        <LastSynced />
        {empty && (inFlight ? <SyncingDashboard /> : <EmptyDashboard />)}
        <DevelopmentCard />
      </View>
    </ScrollView>
  );
}
