import { useMemo, useState } from "react";

import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import { useReportScope, useReportWindow, useRereadReportOnFocus } from "@/lib/query";
import {
  DEFAULT_OVERVIEW_FILTERS,
  assignMemberColors,
  reportBranch,
  type ReportPeriod,
  type ReportScope,
} from "@/lib/report";
import { useViewer } from "@/lib/viewer/use-viewer";

import { MemberLayout } from "./member-layout";
import { ReportOverview } from "./report-overview";
import { ReportEmpty, ReportOffline, ReportSkeleton } from "./report-states";

function OverviewBody({ scope }: { scope: ReportScope }) {
  const [filters, setFilters] = useState(DEFAULT_OVERVIEW_FILTERS);
  const window = useReportWindow(filters.period, {
    kind: "overview",
    groupIds: filters.groupIds,
    userIds: filters.userIds,
  });
  if (window.coldOffline) return <ReportOffline onRetry={window.retry} />;
  const { data } = window;
  if (!data) return <ReportSkeleton />;
  return (
    <ReportOverview
      scope={scope}
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
  if (window.coldOffline || window.forbidden) return <ReportOffline onRetry={window.retry} />;
  const report = window.data;
  if (!report) return <ReportSkeleton />;
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
  if (!viewer) return <ReportSkeleton />;
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
