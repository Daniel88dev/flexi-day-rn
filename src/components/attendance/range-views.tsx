import { ArrowClockwiseIcon, PencilSimpleLineIcon, WarningCircleIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { ClockNotice, NoticeAction } from "@/components/clock/clock-notice";
import { Icon } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  monthStats,
  monthsOfWeek,
  pastDaysNewestFirst,
  useMonthRead,
  weekDates,
  weekRead,
  weekStats,
  type AttendanceBalanceMode,
  type AttendanceMonthDay,
  type Stat,
} from "@/lib/attendance";
import { isoDay } from "@/lib/requests/months";

import { EnteredStamp, Hatch } from "./chips";
import { DayRow } from "./day-row";

export function StatCard({ stats }: { stats: Stat[] }) {
  return (
    <View testID="attendance-stats" className="flex-row flex-wrap rounded-[24px] bg-card px-2 py-3">
      {stats.map((stat) => (
        <View key={stat.label} className="w-1/2 gap-0.5 px-3 py-2">
          <Text className="text-[11px] font-bold tracking-[0.6px] text-faint uppercase">
            {stat.label}
          </Text>
          <Text className="text-[20px] font-semibold text-foreground" style={TABULAR}>
            {stat.value}
          </Text>
          {stat.sub ? <Text className="text-[12px] text-muted-foreground">{stat.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Legend({ swatch, text, testID }: { swatch: ReactNode; text: string; testID: string }) {
  return (
    <View testID={testID} className="flex-row items-start gap-2.5">
      <View className="w-8 items-center pt-0.5">{swatch}</View>
      <Text className="flex-1 text-[12.5px] leading-[18px] text-faint">{text}</Text>
    </View>
  );
}

const hatchedSwatch = (
  <View className="h-4 w-6 overflow-hidden rounded-[4px] border border-border bg-card">
    <Hatch />
  </View>
);

function WeekLegend() {
  const { t } = useTranslation();
  return (
    <View className="px-1 pt-1" testID="attendance-legends">
      <Legend testID="legend-week" swatch={hatchedSwatch} text={t.attendance.weekLegend} />
    </View>
  );
}

function MonthLegends() {
  const { t } = useTranslation();
  const a = t.attendance;
  return (
    <View className="gap-2.5 px-1 pt-1" testID="attendance-legends">
      <Legend testID="legend-hatched" swatch={hatchedSwatch} text={a.hatchedLegend} />
      <Legend testID="legend-entered" swatch={<EnteredStamp compact />} text={a.enteredLegend} />
      <Legend
        testID="legend-changed"
        swatch={<Icon icon={PencilSimpleLineIcon} tone="review" size={15} weight="bold" />}
        text={a.changedLegend}
      />
    </View>
  );
}

function RangeFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <ClockNotice
      testID="attendance-range-failed"
      tone="danger"
      icon={WarningCircleIcon}
      title={t.attendance.rangeFailed}
    >
      <NoticeAction label={t.request.retry} icon={ArrowClockwiseIcon} onPress={onRetry} />
    </ClockNotice>
  );
}

function RangeSkeleton() {
  return (
    <View className="gap-3" testID="attendance-range-loading">
      <View className="h-40 rounded-[24px] bg-card" />
      {[0, 1, 2, 3].map((row) => (
        <View key={row} className="h-[60px] rounded-[16px] bg-card" />
      ))}
    </View>
  );
}

function Rows({
  days,
  mode,
  today,
  onOpenDay,
}: {
  days: AttendanceMonthDay[];
  mode: AttendanceBalanceMode;
  today: string;
  onOpenDay: (date: string) => void;
}) {
  return (
    <View className="gap-2">
      {days.map((day) => (
        <DayRow key={day.businessDate} day={day} mode={mode} today={today} onOpen={onOpenDay} />
      ))}
    </View>
  );
}

export function WeekView({
  anchor,
  today,
  organizationId,
  onOpenDay,
}: {
  anchor: string;
  today: string;
  organizationId: string;
  onOpenDay: (date: string) => void;
}) {
  const { t } = useTranslation();
  const [first, second] = monthsOfWeek(anchor);
  const firstRead = useMonthRead(organizationId, isoDay(first!, 1));
  const secondRead = useMonthRead(organizationId, isoDay(second ?? first!, 1), {
    enabled: !!second,
  });
  const answers = second ? [firstRead, secondRead] : [firstRead];
  const read = weekRead(weekDates(anchor), answers);

  if (read.kind === "loading") return <RangeSkeleton />;
  if (read.kind === "failed") {
    return (
      <RangeFailed
        onRetry={() =>
          answers.filter((answer) => !answer.data).forEach((answer) => void answer.refetch())
        }
      />
    );
  }
  return (
    <View className="gap-4" testID="attendance-week">
      <StatCard stats={weekStats(read.days, t)} />
      {read.days.length === 0 ? (
        <Text className="px-1 text-[14px] text-muted-foreground">{t.attendance.emptyWeek}</Text>
      ) : (
        <>
          <Rows days={read.days} mode={read.mode} today={today} onOpenDay={onOpenDay} />
          <WeekLegend />
        </>
      )}
    </View>
  );
}

export function MonthView({
  anchor,
  today,
  organizationId,
  onOpenDay,
}: {
  anchor: string;
  today: string;
  organizationId: string;
  onOpenDay: (date: string) => void;
}) {
  const { t } = useTranslation();
  const month = useMonthRead(organizationId, anchor);

  if (month.isPending) return <RangeSkeleton />;
  if (!month.data) return <RangeFailed onRetry={() => void month.refetch()} />;

  const worked = month.data.days.some((day) => day.presenceMinutes > 0);
  return (
    <View className="gap-4" testID="attendance-month">
      <StatCard stats={monthStats(month.data, t)} />
      {worked ? null : (
        <Text className="px-1 text-[14px] text-muted-foreground">{t.attendance.emptyMonth}</Text>
      )}
      <Rows
        days={pastDaysNewestFirst(month.data)}
        mode={month.data.balanceMode}
        today={today}
        onOpenDay={onOpenDay}
      />
      <MonthLegends />
    </View>
  );
}
