import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import type { MemberReport, ReportFilters, ReportOverview, ReportScope } from "@/lib/report";

import { qk } from "./keys";
import { reportFiltersToQuery } from "./report-filters";
import { useRereadOnFocus } from "./reread-on-focus";
import { apiRequest } from "./runtime";

export function useReportScope() {
  return useQuery({
    queryKey: qk.reportScope(),
    queryFn: ({ signal }) => apiRequest<ReportScope>("/api/reports/scope", { signal }),
  });
}

/**
 * One year of the overview. It never sends `types`: the screen picks one allowance from the full
 * answer. A filter change keeps the previous answer on screen until the new one lands.
 */
export const reportOverviewQuery = (filters: ReportFilters) =>
  queryOptions({
    queryKey: qk.reportOverview(filters),
    queryFn: ({ signal }) =>
      apiRequest<ReportOverview>(`/api/reports/overview?${reportFiltersToQuery(filters)}`, {
        signal,
      }),
    placeholderData: keepPreviousData,
  });

/** One person's year. A period change keeps the previous year on screen until the new one lands. */
export const memberReportQuery = (userId: string, year: number) =>
  queryOptions({
    queryKey: qk.memberReport(userId, year),
    queryFn: ({ signal }) =>
      apiRequest<MemberReport>(
        `/api/reports/members/${encodeURIComponent(userId)}?year=${String(year)}`,
        { signal }
      ),
    placeholderData: keepPreviousData,
  });

export function useReportOverview(filters: ReportFilters, enabled = true) {
  return useQuery({ ...reportOverviewQuery(filters), enabled });
}

export function useMemberReport(userId: string, year: number, enabled = true) {
  return useQuery({ ...memberReportQuery(userId, year), enabled });
}

const REPORT_READS = [qk.reportScope(), qk.reportOverviews(), qk.memberReports()];

export function useRereadReportOnFocus(): void {
  useRereadOnFocus(REPORT_READS);
}
