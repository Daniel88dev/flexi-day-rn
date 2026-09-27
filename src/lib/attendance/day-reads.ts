import type { QueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/query";

import { monthsOfWeek, yearMonthOf, type AttendanceView } from "./range";

export type DayViewReads = { organizationId: string | null; date: string; today: string };

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

/** `date` is the view's anchor: the day, or any day of the week or month shown. */
export type ViewReads = DayViewReads & { view: AttendanceView };

/** The reads a view shows: a week the one or two months it spans, a month its own. */
export function viewKeys(reads: ViewReads) {
  if (reads.view === "day") return dayViewKeys(reads);
  const state = qk.attendanceState();
  if (!reads.organizationId) return [state];
  const months = reads.view === "week" ? monthsOfWeek(reads.date) : [yearMonthOf(reads.date)];
  return [
    state,
    ...months.map(({ year, month }) => qk.attendanceMonth(year, month, reads.organizationId)),
  ];
}

/** Pull-to-refresh: the visible reads again, resolving once all have answered or failed. */
export async function refreshView(queryClient: QueryClient, reads: ViewReads) {
  await Promise.allSettled(
    viewKeys(reads).map((queryKey) => queryClient.refetchQueries({ queryKey, exact: true }))
  );
}

export function refreshDayView(queryClient: QueryClient, reads: DayViewReads) {
  return refreshView(queryClient, { ...reads, view: "day" });
}
