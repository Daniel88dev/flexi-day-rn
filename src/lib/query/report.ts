import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ReportFilters, ReportOverview, ReportScope } from "@/lib/report";

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
export function useReportOverview(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: qk.reportOverview(filters),
    queryFn: ({ signal }) =>
      apiRequest<ReportOverview>(`/api/reports/overview?${reportFiltersToQuery(filters)}`, {
        signal,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

const REPORT_READS = [qk.reportScope(), qk.reportOverviews()];

export function useRereadReportOnFocus(): void {
  useRereadOnFocus(REPORT_READS);
}
