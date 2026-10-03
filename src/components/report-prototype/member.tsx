// PROTOTYPE (T-143, prototype/report): one member's report, and the viewer's own report when
// their scope is "self".
import { router, useLocalSearchParams } from "expo-router";
import { CaretDownIcon, CaretLeftIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType } from "@/lib/local-store";

import { QuotaChart, useLeaveColor } from "./charts";
import { parsePeriod, useMemberWindow, useProto, type Proto } from "./data";
import { PeriodControl } from "./filters";
import {
  Avatar,
  Card,
  CardTitle,
  IncompleteNote,
  OfflineCold,
  ReportSkeleton,
  SectionTitle,
  StaleNotice,
  StatPair,
  StatusPill,
} from "./parts";
import {
  MONTHS_SHORT,
  activeRecordTypes,
  formatDays,
  monthlySeriesFor,
  remainingFor,
  totalQuotaFor,
  windowLabel,
} from "./series";
import type { MemberChange, MemberReport, ReportBooking, ReportPeriod } from "./types";

function shortDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return { d, m: MONTHS_SHORT[(m ?? 1) - 1] };
}

export function rangeLabel(from: string, to: string): string {
  const a = shortDate(from);
  const b = shortDate(to);
  if (from === to) return `${a.d} ${a.m}`;
  if (a.m === b.m) return `${a.d}-${b.d} ${a.m}`;
  return `${a.d} ${a.m} to ${b.d} ${b.m}`;
}

function AllowanceCard({
  report,
  type,
  slots,
  usage,
  pending,
  tip,
  collapsed,
}: {
  collapsed: boolean;
  pending: boolean;
  report: MemberReport;
  type: CalendarRecordType;
  slots: Parameters<typeof QuotaChart>[0]["slots"];
  usage: Parameters<typeof monthlySeriesFor>[0];
  tip: number | null;
}) {
  const { t } = useTranslation();
  const color = useLeaveColor(type);
  const member = { ...report.member, groupId: report.groups[0]?.groupId ?? "" };
  const r = remainingFor(member, report.summary, type);
  const quota = totalQuotaFor(report.summary, report.member.id, type);
  const series = monthlySeriesFor(usage, report.member.id, slots, type);
  const [open, setOpen] = useState(!collapsed);
  return (
    <Card testID={`allowance-${type}`}>
      <View className="flex-row items-center gap-2">
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
        <Text className="font-display flex-1 text-[16px] font-semibold text-foreground">
          {t.recordTypes[type]}
        </Text>
        <Text className="text-[12.5px] text-faint">{report.year}</Text>
      </View>
      <View className="mt-3 flex-row items-baseline gap-2">
        <Text
          style={TABULAR}
          className={cn(
            "font-display text-[40px] leading-[44px] font-semibold",
            r.remaining < 0 ? "text-danger" : "text-foreground"
          )}
        >
          {formatDays(r.remaining)}
        </Text>
        <Text className="text-[15px] text-muted-foreground">
          {r.remaining < 0 ? "days over" : "days left"} of {formatDays(quota)}
        </Text>
      </View>
      <View className="mt-3 flex-row gap-2 border-t border-border pt-3">
        <StatPair label="Used" value={formatDays(r.usedToDate)} />
        <StatPair label="Planned" value={formatDays(r.planned)} />
        <StatPair label="Pending" value={formatDays(r.pending)} />
        <StatPair label="Carried in" value={formatDays(r.carriedOver)} />
      </View>
      {open ? null : (
        <Pressable
          testID={`allowance-${type}-expand`}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          className="mt-3 flex-row items-center gap-1 self-start py-1 active:opacity-60"
        >
          <Text className="text-[13.5px] font-semibold text-primary">Show months</Text>
          <Icon icon={CaretDownIcon} tone="primary" size={13} weight="bold" />
        </Pressable>
      )}
      {open ? (
        <View className="mt-4">
          <Text className="mb-2 text-[12.5px] text-faint">{windowLabel(slots)}</Text>
          {!pending && series.every((p) => p.used + p.pending === 0) ? (
            <View className="rounded-[16px] bg-muted px-4 py-3">
              <Text className="text-[13.5px] text-muted-foreground">
                None taken or booked in these months.
              </Text>
            </View>
          ) : pending ? (
            <View className="h-[150px] items-center justify-center rounded-[16px] bg-muted">
              <Text className="text-[13px] text-faint">Loading the months</Text>
            </View>
          ) : (
            <QuotaChart slots={slots} type={type} quota={quota} series={series} initialTip={tip} />
          )}
        </View>
      ) : null}
    </Card>
  );
}

function QuotaList({ report }: { report: MemberReport }) {
  return (
    <View className="gap-3">
      {report.groups.map((group) => {
        const q = report.quotas.find((row) => row.groupId === group.groupId);
        const rows: [string, number][] = [
          ["Vacation days", q?.vacationDays ?? 0],
          ["Carried over from last year", q?.carriedOverDays ?? 0],
          ["Home office days", q?.homeOfficeDays ?? 0],
          ...((q?.sickDays ?? 0) > 0 ? [["Sick days", q?.sickDays ?? 0] as [string, number]] : []),
        ];
        return (
          <Card key={group.groupId} testID={`quota-group-${group.groupId}`} className="py-2">
            <Text className="pt-2 pb-1 text-[13px] font-semibold text-muted-foreground">
              {group.groupName}
            </Text>
            {rows.map(([label, value], i) => (
              <View
                key={label}
                className={cn("flex-row items-center py-2.5", i > 0 && "border-t border-border")}
              >
                <Text className="flex-1 text-[15px] text-foreground">{label}</Text>
                <Text style={TABULAR} className="text-[15px] font-semibold text-foreground">
                  {formatDays(value)}
                </Text>
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

function BookingRow({ booking, first }: { booking: ReportBooking; first: boolean }) {
  const { t } = useTranslation();
  const color = useLeaveColor(booking.vacationType);
  return (
    <View
      testID={`booking-${booking.from}-${booking.vacationType}`}
      className={cn("flex-row items-center gap-3 py-3", !first && "border-t border-border")}
    >
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: color }} />
      <View className="flex-1">
        <Text className="text-[15px] font-medium text-foreground">
          {rangeLabel(booking.from, booking.to)}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[12.5px] text-faint">
          {t.recordTypes[booking.vacationType]}
          {booking.note ? `, ${booking.note}` : ""}
        </Text>
      </View>
      <Text style={TABULAR} className="text-[14px] text-muted-foreground">
        {formatDays(booking.days)} d
      </Text>
      <StatusPill status={booking.status} />
    </View>
  );
}

function ChangeRow({ change, first }: { change: MemberChange; first: boolean }) {
  const when = new Date(change.createdAt);
  const date = `${when.getDate()} ${MONTHS_SHORT[when.getMonth()]} ${when.getFullYear()}`;
  const who = change.actor
    ? change.actor.name
    : change.actorDeleted
      ? "a deleted account"
      : "Flexi Day";
  return (
    <View className={cn("py-3", !first && "border-t border-border")}>
      <Text className="text-[15px] leading-[20px] text-foreground">{change.changeDetail}</Text>
      <Text className="mt-0.5 text-[12.5px] text-faint">
        {date}, by {who}
      </Text>
    </View>
  );
}

function Collapsed<T>({
  items,
  limit,
  render,
  empty,
  testID,
}: {
  items: T[];
  limit: number;
  render: (item: T, index: number) => React.ReactNode;
  empty: string;
  testID: string;
}) {
  const [all, setAll] = useState(false);
  if (items.length === 0) {
    return (
      <Card testID={testID}>
        <Text className="py-2 text-[14px] text-faint">{empty}</Text>
      </Card>
    );
  }
  const shown = all ? items : items.slice(0, limit);
  return (
    <Card testID={testID} className="py-1">
      {shown.map(render)}
      {items.length > limit ? (
        <Pressable
          testID={`${testID}-more`}
          onPress={() => setAll((v) => !v)}
          accessibilityRole="button"
          className="border-t border-border py-3 active:opacity-60"
        >
          <Text className="text-[14px] font-semibold text-primary">
            {all ? "Show fewer" : `Show all ${items.length}`}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function MemberBody({
  proto,
  userId,
  period,
  onPeriod,
  years,
  self,
}: {
  proto: Proto;
  userId: string;
  period: ReportPeriod;
  onPeriod: (period: ReportPeriod) => void;
  years: number[];
  self: boolean;
}) {
  const win = useMemberWindow(proto, period, userId);
  const report = win.data;

  if (win.coldOffline) return <OfflineCold onRetry={win.retry} />;
  if (win.forbidden) {
    return (
      <View className="flex-1 justify-center px-8">
        <Text className="font-display text-[22px] font-semibold text-foreground">
          Not in your report
        </Text>
        <Text className="mt-2 text-[15px] text-muted-foreground">
          This person isn&apos;t in a group you can see the report for.
        </Text>
      </View>
    );
  }
  if (!report || (win.state === "pending" && proto.state === "loading")) return <ReportSkeleton />;

  const types = activeRecordTypes(report.summary);
  const groupNames = report.groups.map((g) => g.groupName).join(", ");

  return (
    <ScrollView
      testID={self ? "report-self" : "member-report"}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96, gap: 14 }}
    >
      <View className="flex-row items-center gap-3 pt-1">
        <Avatar user={report.member} size={self ? 44 : 52} />
        <View className="flex-1">
          <Text className="font-display text-[22px] leading-[26px] font-semibold text-foreground">
            {self ? "Your leave" : report.member.name}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-[13.5px] text-muted-foreground">
            {self ? `${report.member.name}, ${groupNames}` : groupNames}
          </Text>
        </View>
      </View>
      <PeriodControl
        proto={proto}
        period={period}
        years={years}
        onChange={onPeriod}
        testID="member-period"
      />
      {win.staleSince ? <StaleNotice since={win.staleSince} onRetry={win.retry} /> : null}
      {win.state === "incomplete" ? (
        <IncompleteNote year={win.priorYear} onRetry={win.retry} />
      ) : null}
      {types.map((type, i) => (
        <AllowanceCard
          key={type}
          report={report}
          type={type}
          slots={win.slots}
          usage={win.usage}
          pending={win.state === "pending"}
          tip={i === 0 ? proto.tip : null}
          collapsed={i > 0}
        />
      ))}
      <View>
        <SectionTitle title="Quotas" meta={String(report.year)} />
        <QuotaList report={report} />
      </View>
      <View>
        <SectionTitle title="Bookings" meta={`${report.bookings.length} in ${report.year}`} />
        <Collapsed
          testID="member-bookings"
          items={report.bookings}
          limit={4}
          empty="No bookings this year."
          render={(b, i) => (
            <BookingRow key={`${b.from}-${b.vacationType}`} booking={b} first={i === 0} />
          )}
        />
      </View>
      <View>
        <SectionTitle title="Change history" />
        <Collapsed
          testID="member-changes"
          items={report.changes}
          limit={3}
          empty="No quota or access changes this year."
          render={(c, i) => <ChangeRow key={c.id} change={c} first={i === 0} />}
        />
      </View>
    </ScrollView>
  );
}

export function MemberScreen() {
  const proto = useProto();
  const params = useLocalSearchParams<{ userId: string; period?: string; years?: string }>();
  const [period, setPeriod] = useState<ReportPeriod>(parsePeriod(params.period));
  const years = (params.years ?? String(new Date().getFullYear())).split(",").map(Number);
  return (
    <View testID="report-member" className="flex-1 bg-background pt-safe">
      <View className="h-14 flex-row items-center gap-1 px-3">
        <Pressable
          testID="stack-back"
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Report"
          className="h-10 flex-row items-center gap-0.5 rounded-full pr-2 active:opacity-70"
        >
          <Icon icon={CaretLeftIcon} tone="foreground" size={22} weight="bold" />
          <Text className="text-[16px] text-foreground">Report</Text>
        </Pressable>
      </View>
      <MemberBody
        proto={proto}
        userId={params.userId}
        period={period}
        onPeriod={setPeriod}
        years={years}
        self={false}
      />
    </View>
  );
}
