import { router } from "expo-router";
import { PlusIcon } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";

import { FilterChips } from "@/components/requests/filter-chips";
import { MonthWindowControl } from "@/components/requests/month-window-control";
import { RequestCard } from "@/components/requests/request-card";
import { ScopeMenu } from "@/components/requests/scope-menu";
import { TabHeader } from "@/components/shell/tab-header";
import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  useRequestListVacations,
  useRequestScopeGroups,
  type RequestListScope,
} from "@/lib/local-store";
import { filterCounts, filterRuns, type RequestFilter } from "@/lib/requests/filters";
import { defaultMonthWindow, monthWindowLabel, requestMonthBounds } from "@/lib/requests/months";
import { collapseRuns, type RequestRun } from "@/lib/requests/runs";
import { useRefreshPull } from "@/lib/use-refresh-pull";
import { useViewer } from "@/lib/viewer/use-viewer";

const openRun = (run: RequestRun) =>
  router.push({ pathname: "/requests/[vacationId]", params: { vacationId: run.vacationIds[0] } });

export default function RequestsScreen() {
  const { t } = useTranslation();
  const viewerId = useViewer()?.id ?? null;
  const primary = useTone("primary");
  const { refreshing, refresh } = useRefreshPull();

  const [{ bounds, defaultWindow }] = useState(() => {
    const today = new Date();
    return { bounds: requestMonthBounds(today), defaultWindow: defaultMonthWindow(today) };
  });
  const [months, setMonths] = useState(defaultWindow);
  const [filter, setFilter] = useState<RequestFilter>("all");
  // The default follows the first group as the menu fills in, as does a group that left it.
  const [choice, setChoice] = useState<{ kind: "default" } | RequestListScope>({
    kind: "default",
  });

  const groups = useRequestScopeGroups();
  const chosen =
    choice.kind === "group" ? groups.find((group) => group.groupId === choice.groupId) : undefined;
  const selected = choice.kind === "mine" ? null : (chosen ?? groups[0] ?? null);
  const scope: RequestListScope = selected
    ? { kind: "group", groupId: selected.groupId }
    : { kind: "mine" };

  const rows = useRequestListVacations({ months, scope });
  const runs = useMemo(() => collapseRuns(rows), [rows]);
  const counts = useMemo(() => filterCounts(runs, viewerId), [runs, viewerId]);
  const shown = useMemo(() => filterRuns(runs, filter, viewerId), [runs, filter, viewerId]);

  const windowLabel = monthWindowLabel(months, t.calendar.monthsShort);

  return (
    <View className="flex-1 bg-background pt-safe">
      <View className="gap-4 px-4 pt-3 pb-4">
        <TabHeader
          title={t.requests.title}
          beforeBell={<ScopeMenu groups={groups} selected={selected} onChange={setChoice} />}
          afterBell={
            <Pressable
              testID="requests-new-request"
              onPress={() => router.push("/requests/new")}
              accessibilityRole="button"
              accessibilityLabel={t.newRequest.title}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-90"
            >
              <Icon icon={PlusIcon} tone="onPrimary" size={18} weight="bold" />
            </Pressable>
          }
        />
        <MonthWindowControl
          value={months}
          bounds={bounds}
          defaultWindow={defaultWindow}
          onChange={setMonths}
        />
      </View>

      <View>
        <FilterChips value={filter} counts={counts} onChange={setFilter} />
      </View>

      <FlatList
        testID="requests-list"
        data={shown}
        keyExtractor={(run) => run.id}
        renderItem={({ item }) => <RequestCard run={item} viewerId={viewerId} onPress={openRun} />}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text className="py-16 text-center text-[15px] text-faint">
            {filter === "all"
              ? t.requests.empty(windowLabel)
              : t.requests.emptyFiltered(filter, windowLabel)}
          </Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={refresh} />
        }
      />
    </View>
  );
}

function Gap() {
  return <View className="h-3" />;
}
