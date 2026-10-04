import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import {
  useReportScope,
  useReportWindow,
  useRereadReportOnFocus,
  type ReportSource,
} from "@/lib/query";
import { reportBranch, type ReportPeriod, type ReportScope } from "@/lib/report";

import { ReportOverview } from "./report-overview";
import { ReportEmpty, ReportOffline, ReportSkeleton } from "./report-states";

const PERIOD: ReportPeriod = "rolling";
const EVERYONE: ReportSource = { kind: "overview" };

function OverviewBody({ scope }: { scope: ReportScope }) {
  const window = useReportWindow(PERIOD, EVERYONE);
  if (window.coldOffline) return <ReportOffline onRetry={window.retry} />;
  const { data } = window;
  if (!data) return <ReportSkeleton />;
  return <ReportOverview scope={scope} window={{ ...window, data }} period={PERIOD} />;
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
