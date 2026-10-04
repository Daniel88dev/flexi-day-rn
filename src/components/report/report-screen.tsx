import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import { useReportOverview, useReportScope, useRereadReportOnFocus } from "@/lib/query";
import { reportBranch } from "@/lib/report";
import { useToday } from "@/lib/use-today";

import { ReportOverview } from "./report-overview";
import { ReportEmpty, ReportOffline, ReportSkeleton } from "./report-states";

function ReportBody() {
  const today = useToday();
  const scope = useReportScope();
  const branch = reportBranch(scope.data, scope.isError);
  // The report opens on the last 12 months, whose figures belong to the current year.
  const year = today.getFullYear();
  const overviewWanted = branch === "overview" || branch === "self";
  const overview = useReportOverview({ year }, overviewWanted);
  useRereadReportOnFocus();

  const retry = () => {
    void scope.refetch();
    if (overviewWanted) void overview.refetch();
  };

  switch (branch) {
    case "loading":
      return <ReportSkeleton />;
    case "offline":
      return <ReportOffline onRetry={retry} />;
    case "empty":
      return <ReportEmpty />;
    case "self":
    case "overview":
      if (!scope.data || !overview.data) {
        return overview.isError ? <ReportOffline onRetry={retry} /> : <ReportSkeleton />;
      }
      return <ReportOverview scope={scope.data} overview={overview.data} period="rolling" />;
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
