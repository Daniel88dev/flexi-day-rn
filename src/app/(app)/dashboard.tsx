import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { toast } from "sonner-native";

import { DevelopmentCard } from "@/components/dashboard/development-card";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { Greeting } from "@/components/dashboard/greeting";
import { LastSynced } from "@/components/dashboard/last-synced";
import { SyncingDashboard } from "@/components/dashboard/syncing-dashboard";
import { useTone } from "@/components/ui/icon";
import { useTranslation } from "@/i18n/use-translation";
import { pull, useStoreRowCounts, useSyncStatus } from "@/lib/local-store";
import { useViewer } from "@/lib/viewer/use-viewer";

export default function DashboardScreen() {
  const { t } = useTranslation();
  const viewer = useViewer();
  const primary = useTone("primary");
  const counts = useStoreRowCounts();
  const { inFlight } = useSyncStatus();
  const [refreshing, setRefreshing] = useState(false);

  const empty = Object.values(counts).every((rows) => rows === 0);

  // A pull-to-refresh never fails quietly; a foreground one says nothing and keeps what is there.
  // The pull resolves when the whole loop ends, a queued rerun included, which is how long the
  // control stays down.
  const refresh = () => {
    setRefreshing(true);
    void pull("refresh")
      .then((outcome) => {
        if (!outcome.ok) toast.error(outcome.message ?? t.sync.unreachable);
      })
      .catch(() => toast.error(t.sync.unreachable))
      .finally(() => setRefreshing(false));
  };

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
