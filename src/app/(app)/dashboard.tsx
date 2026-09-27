import { router } from "expo-router";
import { PlusIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { ApprovalsCard } from "@/components/dashboard/approvals-card";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";
import { DevelopmentCard } from "@/components/dashboard/development-card";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { Greeting } from "@/components/dashboard/greeting";
import { LastSynced } from "@/components/dashboard/last-synced";
import { NoGroupsCard } from "@/components/dashboard/no-groups-card";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { SyncingDashboard } from "@/components/dashboard/syncing-dashboard";
import { Icon, useTone } from "@/components/ui/icon";
import { useTranslation } from "@/i18n/use-translation";
import { statTiles } from "@/lib/dashboard/stats";
import { useGroupStanding, useStoreRowCounts, useSyncStatus } from "@/lib/local-store";
import { useDashboardSummary, useRereadDashboard, useRereadDashboardOnFocus } from "@/lib/query";
import { useRefreshPull } from "@/lib/use-refresh-pull";
import { useViewer } from "@/lib/viewer/use-viewer";

// The new-request route lands with its own ticket. Until then Book and "+" go nowhere.
const noRouteYet = () => undefined;

const openRequest = (vacationId: string) =>
  router.push({ pathname: "/requests/[vacationId]", params: { vacationId } });

const openRequests = () => router.navigate("/requests");

export default function DashboardScreen() {
  const { t } = useTranslation();
  const viewer = useViewer();
  const primary = useTone("primary");
  const counts = useStoreRowCounts();
  const { inFlight, hasCursor } = useSyncStatus();
  const { refreshing, refresh } = useRefreshPull();
  const standing = useGroupStanding();
  const summary = useDashboardSummary();
  const rereadDashboard = useRereadDashboard();
  useRereadDashboardOnFocus();
  const [year, setYear] = useState(() => new Date().getFullYear());

  const empty = Object.values(counts).every((rows) => rows === 0);
  // Only once a pull has finished: before that, no membership just means nothing arrived yet.
  const noGroups = hasCursor && !standing.member;

  return (
    <ScrollView
      testID="dashboard"
      className="flex-1 bg-background pt-safe"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={primary}
          onRefresh={() => {
            refresh();
            rereadDashboard();
          }}
        />
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
        <StatStrip
          tiles={statTiles(summary, { approver: standing.approver })}
          onViewRequests={openRequests}
        />
        {noGroups ? (
          <NoGroupsCard />
        ) : (
          empty && (inFlight ? <SyncingDashboard /> : <EmptyDashboard />)
        )}
      </View>
      {empty || noGroups ? null : (
        <View className="mt-5">
          <DashboardCalendar
            viewerId={viewer?.id ?? null}
            onOpenRequest={openRequest}
            onBook={noRouteYet}
            onYear={setYear}
          />
        </View>
      )}
      <View className="mt-6 gap-4 px-4">
        {standing.approver ? <ApprovalsCard onOpen={openRequest} /> : null}
        {standing.member ? <BalanceCard year={year} /> : null}
        <DevelopmentCard />
      </View>
    </ScrollView>
  );
}
