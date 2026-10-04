import type { ReportFilters } from "@/lib/report";

/** The web's `reportFiltersToQuery`, as the backend's `csvList` parser reads it. */
export function reportFiltersToQuery(filters: ReportFilters): string {
  const query = new URLSearchParams();
  query.set("year", String(filters.year));
  if (filters.groupIds?.length) query.set("groupIds", filters.groupIds.join(","));
  if (filters.userIds?.length) query.set("userIds", filters.userIds.join(","));
  return query.toString();
}
