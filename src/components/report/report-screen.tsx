import { useState } from "react";

import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import { useReportScope, useReportWindow, useRereadReportOnFocus } from "@/lib/query";
import { DEFAULT_OVERVIEW_FILTERS, reportBranch, type ReportScope } from "@/lib/report";

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
