import { useMemo, useState } from "react";

import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import { useReportScope, useReportWindow, useRereadReportOnFocus } from "@/lib/query";
import { assignMemberColors, type ReportPeriod } from "@/lib/report";

import { MemberLayout } from "./member-layout";
import { ReportSkeleton } from "./report-states";

function MemberBody({ userId, initialPeriod }: { userId: string; initialPeriod: ReportPeriod }) {
  const [period, setPeriod] = useState(initialPeriod);
  const scope = useReportScope();
  const window = useReportWindow(period, { kind: "member", userId });
  useRereadReportOnFocus();
  // From the whole scope, as on the overview, so the avatar matches the person's chart colour.
  const colors = useMemo(() => assignMemberColors(scope.data?.members ?? []), [scope.data]);

  const report = window.data;
  if (!report) return <ReportSkeleton />;
  return (
    <MemberLayout
      testID="member-report"
      title={report.member.name}
      subtitle={report.groups.map((group) => group.groupName).join(", ")}
      color={colors[report.member.id] ?? report.member.avatarColor}
      report={report}
      window={window}
      period={period}
      years={scope.data?.years ?? []}
      onPeriodChange={setPeriod}
    />
  );
}

export function MemberReportScreen({ userId, period }: { userId: string; period: ReportPeriod }) {
  const { t } = useTranslation();
  return (
    <StackScreen testID="report-member" backLabel={t.nav.report}>
      <MemberBody userId={userId} initialPeriod={period} />
    </StackScreen>
  );
}
