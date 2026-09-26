import type { Dictionary } from "@/i18n";
import type { VacationStatus } from "@/lib/local-store";

import type { RequestRun } from "./runs";

export type RequestFilter = "all" | "mine" | VacationStatus;

export const REQUEST_FILTERS: readonly RequestFilter[] = [
  "all",
  "mine",
  "pending",
  "approved",
  "rejected",
  "cancelled",
];

export function filterCounts(
  runs: readonly RequestRun[],
  viewerId: string | null
): Record<RequestFilter, number> {
  const counts = { all: runs.length, mine: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const run of runs) {
    counts[run.status] += 1;
    if (viewerId !== null && run.userId === viewerId) counts.mine += 1;
  }
  return counts;
}

export function filterRuns(
  runs: readonly RequestRun[],
  filter: RequestFilter,
  viewerId: string | null
): readonly RequestRun[] {
  if (filter === "all") return runs;
  if (filter === "mine") return runs.filter((run) => viewerId !== null && run.userId === viewerId);
  return runs.filter((run) => run.status === filter);
}

export function filterLabel(filter: RequestFilter, t: Dictionary): string {
  return filter === "all" || filter === "mine" ? t.requests.filters[filter] : t.status[filter];
}
