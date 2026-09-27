import type { QueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/query";

export type DayViewReads = { organizationId: string | null; date: string; today: string };

export function yearMonthOf(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

/**
 * The reads one Day view shows: the clock's `/current`, the day's `/day` unless it is today, whose
 * sessions `/current` carries, and the month holding the day's figures. The clock's read is
 * unscoped, as the clock reads it; the other two need the organization it names.
 */
export function dayViewKeys({ organizationId, date, today }: DayViewReads) {
  const state = qk.attendanceState();
  if (!organizationId) return [state];
  const { year, month } = yearMonthOf(date);
  return [
    state,
    ...(date === today ? [] : [qk.attendanceDay({ organizationId, businessDate: date })]),
    qk.attendanceMonth(year, month, organizationId),
  ];
}

/** Pull-to-refresh: the visible reads again, resolving once all have answered or failed. */
export async function refreshDayView(queryClient: QueryClient, reads: DayViewReads) {
  await Promise.allSettled(
    dayViewKeys(reads).map((queryKey) => queryClient.refetchQueries({ queryKey, exact: true }))
  );
}
