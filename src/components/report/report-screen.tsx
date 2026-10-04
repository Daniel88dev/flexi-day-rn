import { useMemo, useState } from "react";
import { View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import { useReportScope, useReportWindow, useRereadReportOnFocus } from "@/lib/query";
import {
  DEFAULT_OVERVIEW_FILTERS,
  assignMemberColors,
  filtersMoved,
  reportBranch,
  type ReportPeriod,
  type ReportScope,
} from "@/lib/report";
import { useViewer } from "@/lib/viewer/use-viewer";

import { MemberLayout } from "./member-layout";
import { PeriodControls, ReportFilterBar } from "./report-filters";
import { ReportOverview } from "./report-overview";
import { MemberSkeleton, ReportEmpty, ReportOffline, ReportSkeleton } from "./report-states";

function OverviewBody({ scope }: { scope: ReportScope }) {
  const [filters, setFilters] = useState(DEFAULT_OVERVIEW_FILTERS);
  // From the whole scope, never the filtered answer, so a person keeps their colour.
  const colors = useMemo(() => assignMemberColors(scope.members), [scope.members]);
  const window = useReportWindow(filters.period, {
    kind: "overview",
    groupIds: filters.groupIds,
    userIds: filters.userIds,
  });
  if (window.coldOffline) {
    const controls = filtersMoved(filters) ? (
      <View className="pt-1 pb-3">
        <ReportFilterBar scope={scope} colors={colors} filters={filters} onChange={setFilters} />
      </View>
    ) : undefined;
    return <ReportOffline onRetry={window.retry} controls={controls} />;
  }
  const { data } = window;
  if (!data) return <ReportSkeleton />;
  return (
    <ReportOverview
      scope={scope}
      colors={colors}
      window={{ ...window, data }}
      filters={filters}
      onFiltersChange={setFilters}
    />
  );
}

function SelfReport({ scope, userId }: { scope: ReportScope; userId: string }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriod>("rolling");
  const window = useReportWindow(period, { kind: "member", userId });
  const colors = useMemo(() => assignMemberColors(scope.members), [scope.members]);
  // A viewer may always read their own report, so a refusal gets Retry, not "Not in your report".
  if (window.coldOffline || window.forbidden) {
    const controls =
      period === "rolling" ? undefined : (
        <PeriodControls period={period} years={scope.years} onChange={setPeriod} />
      );
    return <ReportOffline onRetry={window.retry} controls={controls} />;
  }
  const report = window.data;
  if (!report) return <MemberSkeleton />;
  const groups = report.groups.map((group) => group.groupName).join(", ");
  return (
    <MemberLayout
      testID="report-self"
      title={t.report.yourLeave}
      subtitle={`${report.member.name}, ${groups}`}
      color={colors[report.member.id] ?? report.member.avatarColor}
      report={report}
      window={window}
      period={period}
      years={scope.years}
      onPeriodChange={setPeriod}
    />
  );
}

function SelfBody({ scope }: { scope: ReportScope }) {
  const viewer = useViewer();
  if (!viewer) return <MemberSkeleton />;
  return <SelfReport scope={scope} userId={viewer.id} />;
}

function ReportBody() {
  const scope = useReportScope();
  const branch = reportBranch(scope.data, scope.isError);
  useRereadReportOnFocus();

  switch (branch) {
    case "loading":
      return <ReportSkeleton />;
    case "offline":
      return <ReportOffline onRetry={() => void scope.refetch()} />;
    case "empty":
      return <ReportEmpty />;
    case "self":
      return scope.data ? <SelfBody scope={scope.data} /> : <ReportSkeleton />;
    case "overview":
      return scope.data ? <OverviewBody scope={scope.data} /> : <ReportSkeleton />;
  }
}

export function ReportScreen() {
  const { t } = useTranslation();
  return (
    <StackScreen testID="report" title={t.nav.report}>
      <ReportBody />
    </StackScreen>
  );
}
