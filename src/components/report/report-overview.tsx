import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import type { CalendarRecordType } from "@/lib/local-store";
import type { ReportWindow } from "@/lib/query";
import {
  activeRecordTypes,
  daysLeftScale,
  peopleSections,
  uniqueMembers,
  type OverviewFilters,
  type ReportOverview as Overview,
  type ReportScope,
} from "@/lib/report";

import { LeaveTypeTabs } from "./leave-type-tabs";
import { PeopleList } from "./people-list";
import { ReportFilterBar } from "./report-filters";
import { ReportStale } from "./report-states";
import { UsageCard } from "./usage-card";

export function ReportOverview({
  scope,
  colors,
  window,
  filters,
  onFiltersChange,
}: {
  scope: ReportScope;
  colors: Record<string, string>;
  window: ReportWindow<Overview> & { data: Overview };
  filters: OverviewFilters;
  onFiltersChange: (filters: OverviewFilters) => void;
}) {
  const overview = window.data;
  const [picked, setPicked] = useState<CalendarRecordType | null>(null);
  const types = useMemo(() => activeRecordTypes(overview.summary), [overview.summary]);
  if (picked && !types.includes(picked)) setPicked(null);
  const type = picked ?? types[0];
  const members = useMemo(() => uniqueMembers(overview.members), [overview.members]);
  const sections = useMemo(() => peopleSections(overview, type), [overview, type]);
  const scale = daysLeftScale(sections.flatMap((section) => section.rows));

  const open = (userId: string) =>
    router.push({
      pathname: "/report/[userId]",
      params: { userId, period: String(filters.period) },
    });

  return (
    <ScrollView testID="report-overview" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="pt-1 pb-3">
        <ReportFilterBar
          scope={scope}
          colors={colors}
          filters={filters}
          onChange={onFiltersChange}
        />
      </View>
      <View className="px-4 pb-2">
        <LeaveTypeTabs types={types} value={type} onChange={setPicked} />
      </View>
      <View className="gap-3.5 px-4">
        {window.staleSince ? (
          <ReportStale since={window.staleSince} onRetry={window.retry} />
        ) : null}
        <UsageCard window={window} members={members} colors={colors} type={type} />
        {sections.map((section) => (
          <PeopleList
            key={section.group.groupId}
            section={section}
            year={overview.year}
            scale={scale}
            type={type}
            colors={colors}
            onOpen={open}
          />
        ))}
      </View>
    </ScrollView>
  );
}
