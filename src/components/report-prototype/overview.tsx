// PROTOTYPE (T-143, prototype/report): the report screen. A viewer whose scope is all "self"
// gets their own report instead of a team overview.
import { router } from "expo-router";
import { CaretRightIcon, ChartBarIcon } from "phosphor-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { Icon } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType } from "@/lib/local-store";
import { useViewer } from "@/lib/viewer/use-viewer";

import { MiniRemainingBar, RemainingChart, UsageChart } from "./charts";
import { useOverviewWindow, useProto, type Proto } from "./data";
import { FilterBar, TypeTabs } from "./filters";
import { MemberBody } from "./member";
import {
  Avatar,
  Card,
  CardTitle,
  IncompleteNote,
  OfflineCold,
  ProtoBar,
  ReportSkeleton,
  SectionTitle,
  StaleNotice,
} from "./parts";
import {
  activeRecordTypes,
  assignMemberColors,
  buildMemberRemaining,
  buildTeamMonthlySeries,
  formatDays,
  uniqueMembers,
  windowLabel,
  type MemberRemaining,
} from "./series";
import type { ReportFilters, ReportPeriod } from "./types";

function openMember(proto: Proto, id: string, period: ReportPeriod, years: number[]) {
  const q = new URLSearchParams({ period: String(period), years: years.join(",") });
  if (proto.demo) q.set("data", "demo");
  router.push(`/report/${id}?${q.toString()}`);
}

function PersonRow({
  row,
  first,
  onPress,
  bar,
}: {
  row: MemberRemaining;
  first: boolean;
  onPress: () => void;
  bar?: ReactNode;
}) {
  const used = row.usedToDate;
  const parts = [`${formatDays(used)} used`];
  if (row.planned > 0) parts.push(`${formatDays(row.planned)} planned`);
  if (row.pending > 0) parts.push(`${formatDays(row.pending)} pending`);
  return (
    <Pressable
      testID={`member-row-${row.member.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.member.name}, ${formatDays(row.remaining)} days left`}
      className={cn(
        "flex-row items-center gap-3 py-3 active:opacity-60",
        !first && "border-t border-border"
      )}
    >
      <Avatar user={row.member} size={36} />
      <View className="flex-1">
        <Text numberOfLines={1} className="text-[15.5px] font-medium text-foreground">
          {row.member.name}
        </Text>
        {bar}
        <Text numberOfLines={1} className="mt-1 text-[12.5px] text-faint">
          {parts.join(", ")}
        </Text>
      </View>
      <View className="items-end">
        <Text
          style={TABULAR}
          className={cn(
            "font-display text-[19px] leading-[22px] font-semibold",
            row.remaining < 0 ? "text-danger" : "text-foreground"
          )}
        >
          {formatDays(row.remaining)}
        </Text>
        <Text className="text-[11.5px] text-faint">
          of {formatDays(row.carriedOver + row.yearQuota)}
        </Text>
      </View>
      <Icon icon={CaretRightIcon} tone="faint" size={14} weight="bold" />
    </Pressable>
  );
}

function EmptyScope() {
  return (
    <View testID="report-empty" className="flex-1 items-start justify-center px-8 pb-24">
      <View className="mb-5 h-14 w-14 items-center justify-center rounded-[16px] bg-accent">
        <Icon icon={ChartBarIcon} tone="primary" size={28} />
      </View>
      <Text className="font-display text-[24px] font-semibold text-foreground">
        Nothing to report yet
      </Text>
      <Text className="mt-2 text-[15px] leading-[21px] text-muted-foreground">
        The report covers the groups you belong to. Join a group and your leave shows up here.
      </Text>
    </View>
  );
}

function TeamReport({ proto }: { proto: Proto }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriod>("rolling");
  const [filters, setFilters] = useState<ReportFilters>({ groupIds: [], userIds: [], types: [] });
  const [picked, setPicked] = useState<CalendarRecordType | null>(null);
  const win = useOverviewWindow(proto, period, filters);
  const scope = win.scope.data;
  const overview = win.data;

  const members = useMemo(() => uniqueMembers(overview?.members ?? []), [overview]);
  const colors = useMemo(() => assignMemberColors(scope?.members ?? []), [scope]);
  const types = useMemo(
    () => (overview ? activeRecordTypes(overview.summary, filters.types) : []),
    [overview, filters.types]
  );
  const type = picked && types.includes(picked) ? picked : (types[0] ?? "VACATION");

  if (win.coldOffline) return <OfflineCold onRetry={win.retry} />;
  if (!scope || !overview || proto.state === "loading") return <ReportSkeleton />;

  const ids = members.map((m) => m.id);
  const series = buildTeamMonthlySeries(win.usage, ids, type, win.slots);
  const total = series.reduce(
    (sum, row) => sum + ids.reduce((s, id) => s + (row.values[id] ?? 0), 0),
    0
  );
  const remaining = buildMemberRemaining(members, overview.summary, type);
  const merged = proto.layout === "merged";
  const sections = overview.groups
    .filter((g) => filters.groupIds.length === 0 || filters.groupIds.includes(g.groupId))
    .map((g) => ({
      groupId: g.groupId,
      name: g.groupName,
      rows: buildMemberRemaining(
        overview.members.filter((m) => m.groupId === g.groupId),
        overview.summary.filter((row) => row.groupId === g.groupId),
        type
      ),
    }))
    .filter((section) => section.rows.length > 0);
  const scaleMax = {
    pos: Math.max(1, ...remaining.map((r) => r.carriedOverLeft + r.yearLeft)),
    neg: Math.max(0, ...remaining.map((r) => -r.overdraft)),
  };
  const label = t.recordTypes[type];
  const years = scope.years.length ? scope.years : [win.year];

  return (
    <ScrollView testID="report-overview" contentContainerStyle={{ paddingBottom: 96 }}>
      <View className="gap-3 pt-1 pb-4">
        <FilterBar
          proto={proto}
          scope={scope}
          filters={filters}
          onFilters={setFilters}
          period={period}
          onPeriod={setPeriod}
        />
        <TypeTabs types={types} value={type} onChange={setPicked} />
      </View>
      <View className="gap-3.5 px-4">
        {win.staleSince ? <StaleNotice since={win.staleSince} onRetry={win.retry} /> : null}
        <Card testID="usage-card">
          <CardTitle
            title={`${label} taken`}
            meta={windowLabel(win.slots)}
            right={
              <View className="items-end">
                <Text
                  style={TABULAR}
                  className="font-display text-[19px] leading-[22px] font-semibold text-foreground"
                >
                  {formatDays(Number(total.toFixed(2)))}
                </Text>
                <Text className="text-[11.5px] text-faint">days</Text>
              </View>
            }
          />
          {win.state === "incomplete" ? (
            <IncompleteNote year={win.priorYear} onRetry={win.retry} />
          ) : null}
          {win.state === "pending" ? (
            <View className="h-[168px] items-center justify-center rounded-[16px] bg-muted">
              <Text className="text-[13px] text-faint">Loading the months</Text>
            </View>
          ) : members.length === 0 ? (
            <Text className="py-6 text-[14px] text-faint">No one matches these filters.</Text>
          ) : (
            <UsageChart
              key={`${type}-${ids.join()}`}
              slots={win.slots}
              series={series}
              members={members}
              colors={colors}
              initialTip={proto.tip}
            />
          )}
        </Card>
        {merged ? null : (
          <Card testID="remaining-card">
            <CardTitle title={`${label} left`} meta={`${win.year}, most left first`} />
            <RemainingChart
              key={type}
              rows={remaining}
              type={type}
              year={win.year}
              onOpen={(id) => openMember(proto, id, period, years)}
            />
          </Card>
        )}
        {sections.map((section) => (
          <View key={section.groupId} testID={`people-${section.groupId}`}>
            <SectionTitle
              title={merged && sections.length === 1 ? `${label} left` : section.name}
              meta={
                merged
                  ? `${section.rows.length} people, ${win.year}`
                  : `${section.rows.length} people`
              }
            />
            <Card className="py-1">
              {section.rows.map((row, i) => (
                <PersonRow
                  key={row.member.id}
                  row={row}
                  first={i === 0}
                  onPress={() => openMember(proto, row.member.id, period, years)}
                  bar={
                    merged ? (
                      <MiniRemainingBar r={row} pos={scaleMax.pos} neg={scaleMax.neg} type={type} />
                    ) : undefined
                  }
                />
              ))}
            </Card>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Report() {
  const proto = useProto();
  const viewer = useViewer();
  const [period, setPeriod] = useState<ReportPeriod>("rolling");
  const win = useOverviewWindow(proto, "rolling", { groupIds: [], userIds: [], types: [] });
  const scope = win.scope.data;

  if (proto.state === "empty" || (scope && scope.groups.length === 0)) return <EmptyScope />;
  const self =
    proto.self || (scope !== undefined && scope.groups.every((g) => g.access === "self"));
  if (self && scope) {
    const id = proto.demo ? (scope.members[0]?.id ?? "") : (viewer?.id ?? "");
    return (
      <MemberBody
        proto={proto}
        userId={id}
        period={period}
        onPeriod={setPeriod}
        years={scope.years.length ? scope.years : [new Date().getFullYear()]}
        self
      />
    );
  }
  if (!scope && win.scope.isError && proto.state !== "loading")
    return <OfflineCold onRetry={win.retry} />;
  return <TeamReport proto={proto} />;
}

export function ReportScreen() {
  const { t } = useTranslation();
  const proto = useProto();
  return (
    <StackScreen testID="report" title={t.nav.report}>
      <Report />
      <ProtoBar proto={proto} />
    </StackScreen>
  );
}
