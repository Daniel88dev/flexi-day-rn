import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { FilterChips } from "@/components/requests/filter-chips";
import { MonthStepper } from "@/components/requests/month-stepper";
import { RequestCard } from "@/components/requests/request-card";
import { ScopeMenu } from "@/components/requests/scope-menu";
import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  useRequestListVacations,
  useRequestScopeGroups,
  type RequestListScope,
} from "@/lib/local-store";
import { filterCounts, filterLabel, filterRuns, type RequestFilter } from "@/lib/requests/filters";
import { currentMonth, requestMonthBounds, stepMonth } from "@/lib/requests/months";
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

  const [bounds] = useState(() => requestMonthBounds(new Date()));
  const [month, setMonth] = useState(() => currentMonth(new Date()));
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

  const rows = useRequestListVacations({ month, scope });
  const runs = useMemo(() => collapseRuns(rows), [rows]);
  const counts = useMemo(() => filterCounts(runs, viewerId), [runs, viewerId]);
  const shown = useMemo(() => filterRuns(runs, filter, viewerId), [runs, filter, viewerId]);

  const step = (delta: -1 | 1) => {
    const next = stepMonth(month, delta, bounds);
    if (next) setMonth(next);
  };

  return (
    <View className="flex-1 bg-background pt-safe">
      <View className="gap-4 px-4 pt-3 pb-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="font-display text-[28px] font-semibold text-foreground"
            style={{ letterSpacing: -0.56 }}
          >
            {t.requests.title}
          </Text>
          <ScopeMenu groups={groups} selected={selected} onChange={setChoice} />
        </View>
        <MonthStepper
          month={month}
          canPrevious={stepMonth(month, -1, bounds) !== null}
          canNext={stepMonth(month, 1, bounds) !== null}
          onStep={step}
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
            {filter === "all" ? t.requests.empty : t.requests.emptyFiltered(filterLabel(filter, t))}
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
