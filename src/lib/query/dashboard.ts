import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { approvalKey } from "@/lib/dashboard/approvals";
import { approveVacations, rejectVacations, type CalendarRecordType } from "@/lib/local-store";

import { qk } from "./keys";
import { useRereadOnFocus } from "./reread-on-focus";
import { apiRequest } from "./runtime";
import { useVacationWrite } from "./vacation-actions";
import type { UserSummary } from "./vacation-detail";

export type DashboardSummary = {
  pendingApprovalsCount: number;
  outTodayCount: number;
  workingTodayCount: number;
  upcomingNext14DaysCount: number;
  teamSize: number;
};

export type DashboardSummaryRead =
  { state: "loading" } | { state: "failed" } | { state: "ready"; summary: DashboardSummary };

export type PendingApproval = {
  vacationIds: string[];
  user: UserSummary;
  groupId: string;
  groupName: string;
  vacationType: CalendarRecordType;
  from: string;
  to: string;
  businessDays: number;
  note: string | null;
  submittedAt: string;
};

/**
 * The stat tiles' counts, from the server only: the Local store lacks other members' rows in
 * groups the viewer only reports on, so counting there would disagree with the web. A failed
 * latest read is `failed` even with an earlier answer cached, so an offline strip never shows old
 * counts.
 */
export function useDashboardSummary(): DashboardSummaryRead {
  const query = useQuery({
    queryKey: qk.dashboardSummary(),
    queryFn: ({ signal }) =>
      apiRequest<DashboardSummary>("/api/users/me/dashboard-summary", { signal }),
  });
  if (query.isError) return { state: "failed" };
  if (query.data) return { state: "ready", summary: query.data };
  return { state: "loading" };
}

export function useMyApprovals() {
  return useQuery({
    queryKey: qk.myApprovals(),
    queryFn: ({ signal }) => apiRequest<PendingApproval[]>("/api/users/me/approvals", { signal }),
  });
}

const DASHBOARD_READS = [qk.dashboardSummary(), qk.myApprovals()];

export function useRereadDashboardOnFocus(): void {
  useRereadOnFocus(DASHBOARD_READS);
}

/** For pull-to-refresh, beside the sync pull. */
export function useRereadDashboard(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    for (const queryKey of DASHBOARD_READS) void queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);
}

export type ApprovalDecision = "approve" | "decline";

export function useApprovalDecisions() {
  const { busy, run } = useVacationWrite<{ id: string; decision: ApprovalDecision }>([
    qk.myApprovals(),
    qk.dashboardSummary(),
  ]);

  return {
    deciding: busy,
    approve: (item: PendingApproval) =>
      run({ id: approvalKey(item), decision: "approve" }, () => approveVacations(item.vacationIds)),
    decline: (item: PendingApproval, reason?: string) =>
      run({ id: approvalKey(item), decision: "decline" }, () =>
        rejectVacations(item.vacationIds, reason)
      ),
  };
}
