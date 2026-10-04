import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import type { CalendarRecordType } from "@/lib/local-store";
import {
  activeRecordTypes,
  assignMemberColors,
  daysLeftScale,
  peopleSections,
  type ReportOverview as Overview,
  type ReportPeriod,
  type ReportScope,
} from "@/lib/report";

import { LeaveTypeTabs } from "./leave-type-tabs";
import { PeopleList } from "./people-list";

export function ReportOverview({
  scope,
  overview,
  period,
}: {
  scope: ReportScope;
  overview: Overview;
  period: ReportPeriod;
}) {
  const [picked, setPicked] = useState<CalendarRecordType | null>(null);
  // From the whole scope, never the filtered answer, so a person keeps their colour.
  const colors = useMemo(() => assignMemberColors(scope.members), [scope.members]);
  const types = useMemo(() => activeRecordTypes(overview.summary), [overview.summary]);
  const type = picked && types.includes(picked) ? picked : types[0];
  const sections = useMemo(() => peopleSections(overview, type), [overview, type]);
  const scale = daysLeftScale(sections.flatMap((section) => section.rows));

  const open = (userId: string) =>
    router.push({ pathname: "/report/[userId]", params: { userId, period: String(period) } });

  return (
    <ScrollView testID="report-overview" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="px-4 pt-1 pb-2">
        <LeaveTypeTabs types={types} value={type} onChange={setPicked} />
      </View>
      <View className="gap-3.5 px-4">
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
