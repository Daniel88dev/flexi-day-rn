import { CaretDownIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType } from "@/lib/local-store";
import type { ReportWindow } from "@/lib/query";
import {
  formatDays,
  monthlySeriesFor,
  remainingFor,
  totalQuotaFor,
  windowLabel,
  type MemberReport,
  type ReportUser,
} from "@/lib/report";

import { useLeaveColor } from "./leave-color";
import { QuotaChart } from "./quota-chart";

export type AllowanceWindow = Pick<ReportWindow<unknown>, "slots" | "usage" | "state">;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} className="flex-1">
      <Text numberOfLines={1} className="text-[12.5px] text-faint">
        {label}
      </Text>
      <Text style={TABULAR} className="mt-0.5 text-[17px] font-semibold text-foreground">
        {value}
      </Text>
    </View>
  );
}

function Months({
  type,
  person,
  quota,
  window,
}: {
  type: CalendarRecordType;
  person: ReportUser;
  quota: number;
  window: AllowanceWindow;
}) {
  const { t } = useTranslation();
  const { slots, usage, state } = window;
  const series = monthlySeriesFor(usage, person.id, slots, type);
  const empty = series.every((point) => point.used + point.pending === 0);
  const first = slots[0];

  return (
    <View className="mt-4">
      <Text className="mb-2 text-[12.5px] text-faint">
        {windowLabel(slots, t.calendar.monthsShort, t.report.windowRange)}
      </Text>
      {state === "pending" ? (
        <View className="h-[150px] items-center justify-center rounded-[16px] bg-muted">
          <Text className="text-[13px] text-faint">{t.report.loadingMonths}</Text>
        </View>
      ) : empty ? (
        <View className="rounded-[16px] bg-muted px-4 py-3">
          <Text className="text-[13.5px] text-muted-foreground">
            {t.report.member.noneInWindow}
          </Text>
        </View>
      ) : (
        <QuotaChart
          key={first ? `${first.year}-${first.month}` : "none"}
          type={type}
          slots={slots}
          series={series}
          quota={quota}
        />
      )}
    </View>
  );
}

/** A card that starts closed draws its months only once "Show months" is tapped. */
export function AllowanceCard({
  type,
  report,
  window,
  initiallyOpen,
}: {
  type: CalendarRecordType;
  report: MemberReport;
  window: AllowanceWindow;
  initiallyOpen: boolean;
}) {
  const { t } = useTranslation();
  const labels = t.report.member;
  const color = useLeaveColor(type);
  const [open, setOpen] = useState(initiallyOpen);
  const days = (value: number) => formatDays(value, t.common.decimalSeparator);

  const person = report.member;
  const groupId = report.groups[0]?.groupId ?? "";
  const row = remainingFor({ ...person, groupId }, report.summary, type);
  const quota = totalQuotaFor(report.summary, person.id, type);
  const over = row.remaining < 0;
  const figure = days(Math.abs(row.remaining));
  const caption = over
    ? labels.daysOverOf(Math.abs(row.remaining), days(quota))
    : labels.daysLeftOf(row.remaining, days(quota));

  return (
    <View
      testID={`allowance-${type}`}
      className="rounded-[24px] border border-border bg-card px-4 pt-4 pb-4"
    >
      <View className="flex-row items-center gap-2">
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
        <Text className="font-display flex-1 text-[16px] font-semibold text-foreground">
          {t.recordTypes[type]}
        </Text>
        <Text className="text-[12.5px] text-faint">{report.year}</Text>
      </View>
      <View
        testID={`allowance-${type}-left`}
        accessible
        accessibilityLabel={`${figure} ${caption}`}
        className="mt-3 flex-row items-baseline gap-2"
      >
        <Text
          style={TABULAR}
          className={cn(
            "font-display text-[40px] leading-[44px] font-semibold",
            over ? "text-danger" : "text-foreground"
          )}
        >
          {figure}
        </Text>
        <Text className={cn("flex-1 text-[15px]", over ? "text-danger" : "text-muted-foreground")}>
          {caption}
        </Text>
      </View>
      <View className="mt-3 flex-row gap-2 border-t border-border pt-3">
        <Stat label={labels.used} value={days(row.usedToDate)} />
        <Stat label={labels.planned} value={days(row.planned)} />
        <Stat label={labels.pending} value={days(row.pending)} />
        <Stat label={labels.carriedIn} value={days(row.carriedOver)} />
      </View>
      {open ? (
        <Months type={type} person={person} quota={quota} window={window} />
      ) : (
        <Pressable
          testID={`allowance-${type}-expand`}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={labels.showMonthsLabel(t.recordTypes[type])}
          accessibilityState={{ expanded: false }}
          hitSlop={8}
          className="mt-3 flex-row items-center gap-1 self-start py-1 active:opacity-60"
        >
          <Text className="text-[13.5px] font-semibold text-primary">{labels.showMonths}</Text>
          <Icon icon={CaretDownIcon} tone="primary" size={13} weight="bold" />
        </Pressable>
      )}
    </View>
  );
}
