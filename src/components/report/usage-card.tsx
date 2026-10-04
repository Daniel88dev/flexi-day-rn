import { View } from "react-native";

import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import type { CalendarRecordType } from "@/lib/local-store";
import type { ReportWindow } from "@/lib/query";
import {
  buildTeamMonthlySeries,
  formatDays,
  seriesTotal,
  windowLabel,
  type ReportScopeMember,
} from "@/lib/report";

import { IncompleteNote } from "./report-states";
import { UsageChart } from "./usage-chart";

type UsageWindow = Pick<ReportWindow<unknown>, "slots" | "usage" | "state" | "priorYear" | "retry">;

export function UsageCard({
  window,
  members,
  colors,
  type,
}: {
  window: UsageWindow;
  members: ReportScopeMember[];
  colors: Record<string, string>;
  type: CalendarRecordType;
}) {
  const { t } = useTranslation();
  const ids = members.map((member) => member.id);
  const series = buildTeamMonthlySeries(window.usage, ids, type, window.slots);
  const total = seriesTotal(series);
  const pending = window.state === "pending";

  return (
    <View testID="usage-card" className="rounded-[24px] border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display text-[17px] font-semibold text-foreground">
            {t.report.taken(t.recordTypes[type])}
          </Text>
          <Text className="mt-0.5 text-[13px] text-faint">
            {windowLabel(window.slots, t.calendar.monthsShort, t.report.windowRange)}
          </Text>
        </View>
        {pending ? null : (
          <View className="items-end">
            <Text
              style={TABULAR}
              className="font-display text-[19px] leading-[22px] font-semibold text-foreground"
            >
              {formatDays(total, t.common.decimalSeparator)}
            </Text>
            <Text className="text-[11.5px] text-faint">{t.report.days(total)}</Text>
          </View>
        )}
      </View>
      {window.state === "incomplete" ? (
        <View className="mt-3">
          <IncompleteNote year={window.priorYear} onRetry={window.retry} />
        </View>
      ) : null}
      <View className="mt-4">
        {pending ? (
          <View className="h-[168px] items-center justify-center rounded-[16px] bg-muted">
            <Text className="text-[13px] text-faint">{t.report.loadingMonths}</Text>
          </View>
        ) : members.length === 0 ? (
          <Text className="py-6 text-[14px] text-faint">{t.report.noOneMatches}</Text>
        ) : (
          <UsageChart
            key={`${type}:${ids.join(",")}`}
            series={series}
            members={members}
            colors={colors}
          />
        )}
      </View>
    </View>
  );
}
