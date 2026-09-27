import { PlusIcon } from "phosphor-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";
import { DevelopmentCard } from "@/components/dashboard/development-card";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { Greeting } from "@/components/dashboard/greeting";
import { LastSynced } from "@/components/dashboard/last-synced";
import { SyncingDashboard } from "@/components/dashboard/syncing-dashboard";
import { Icon, useTone } from "@/components/ui/icon";
import { useTranslation } from "@/i18n/use-translation";
import { useStoreRowCounts, useSyncStatus } from "@/lib/local-store";
import { useRefreshPull } from "@/lib/use-refresh-pull";
import { useViewer } from "@/lib/viewer/use-viewer";

// The request detail and new-request routes land with the Requests tickets. Until then a bar or
// a row has no tap at all, and Book and "+" go nowhere.
const noRouteYet = () => undefined;

export default function DashboardScreen() {
  const { t } = useTranslation();
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
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Greeting viewer={viewer} />
          </View>
          <Pressable
            testID="dashboard-new-request"
            onPress={noRouteYet}
            accessibilityRole="button"
            accessibilityLabel={t.dashboard.newRequest}
            className="mt-1 h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-90"
          >
            <Icon icon={PlusIcon} tone="onPrimary" size={20} weight="bold" />
          </Pressable>
        </View>
        <LastSynced />
        {empty && (inFlight ? <SyncingDashboard /> : <EmptyDashboard />)}
      </View>
      {empty ? null : (
        <View className="mt-5">
          <DashboardCalendar viewerId={viewer?.id ?? null} onBook={noRouteYet} />
        </View>
      )}
      <View className="mt-5 px-4">
        <DevelopmentCard />
      </View>
    </ScrollView>
  );
}
