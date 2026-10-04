import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { ReportWindow } from "@/lib/query";
import { activeRecordTypes, type MemberReport, type ReportPeriod } from "@/lib/report";

import { AllowanceCard } from "./allowance-card";
import { MemberBookings, MemberChanges, MemberQuotas } from "./member-sections";
import { ReportAvatar } from "./report-avatar";
import { PeriodChip } from "./report-filters";
import { IncompleteNote } from "./report-states";

export type MemberWindow = Pick<
  ReportWindow<MemberReport>,
  "slots" | "usage" | "state" | "priorYear" | "retry"
>;

/**
 * One person's report: who it is, the period, a card per allowance with only the first one's months
 * drawn, then quotas, bookings and change history. The member screen and the self view differ only
 * in the heading they pass.
 */
export function MemberLayout({
  testID,
  title,
  subtitle,
  color,
  report,
  window,
  period,
  years,
  onPeriodChange,
}: {
  testID: string;
  title: string;
  subtitle: string;
  color: string;
  report: MemberReport;
  window: MemberWindow;
  period: ReportPeriod;
  years: number[];
  onPeriodChange: (period: ReportPeriod) => void;
}) {
  const types = activeRecordTypes(report.summary);

  return (
    <ScrollView
      testID={testID}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 14 }}
    >
      <View className="flex-row items-center gap-3 pt-1">
        <ReportAvatar user={report.member} color={color} size={52} />
        <View className="flex-1">
          <Text className="font-display text-[22px] leading-[26px] font-semibold text-foreground">
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={2} className="mt-0.5 text-[13.5px] text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row">
        <PeriodChip
          testID="member-period"
          period={period}
          years={years}
          onChange={onPeriodChange}
        />
      </View>
      {window.state === "incomplete" ? (
        <IncompleteNote year={window.priorYear} onRetry={window.retry} />
      ) : null}
      {types.map((type, index) => (
        <AllowanceCard
          key={type}
          type={type}
          report={report}
          window={window}
          initiallyOpen={index === 0}
        />
      ))}
      <MemberQuotas report={report} />
      <MemberBookings report={report} />
      <MemberChanges report={report} />
    </ScrollView>
  );
}
