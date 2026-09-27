import { addDays, mondayIndex } from "@/lib/days";
import { addMonths, isoDay, type YearMonth } from "@/lib/requests/months";

import type { AttendanceBalanceMode, AttendanceMonth, AttendanceMonthDay } from "./types";

export function yearMonthOf(date: string): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

/** The Monday of the week a date falls in. The product's weeks start on Monday. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -mondayIndex(iso));
}

export function weekDates(iso: string): string[] {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

const sameMonth = (a: YearMonth, b: YearMonth) => a.year === b.year && a.month === b.month;

/**
 * The one or two months a week's days fall in. `/month` is what the backend answers, so a week
 * across a month's end reads both.
 */
export function monthsOfWeek(iso: string): YearMonth[] {
  const monday = startOfWeek(iso);
  const first = yearMonthOf(monday);
  const last = yearMonthOf(addDays(monday, 6));
  return sameMonth(first, last) ? [first] : [first, last];
}

export type MonthAnswer = { data: AttendanceMonth | undefined; isPending: boolean };

export type WeekRead =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; days: AttendanceMonthDay[]; mode: AttendanceBalanceMode };

/**
 * A week from the months it spans: every month or none. Half a straddling week would read as a
 * whole one, its totals over four days under a heading that promises seven.
 */
export function weekRead(dates: string[], answers: MonthAnswer[]): WeekRead {
  if (answers.some((answer) => answer.isPending)) return { kind: "loading" };
  const months = answers.flatMap((answer) => (answer.data ? [answer.data] : []));
  if (months.length !== answers.length || months.length === 0) return { kind: "failed" };

  const byDate = new Map(
    months.flatMap((month) => month.days).map((day) => [day.businessDate, day])
  );
  return {
    kind: "ready",
    days: dates.flatMap((date) => byDate.get(date) ?? []),
    mode: months[0]!.balanceMode,
  };
}

export function pastDaysNewestFirst(month: AttendanceMonth): AttendanceMonthDay[] {
  return month.days
    .filter((day) => !day.upcoming)
    .sort((a, b) => (a.businessDate < b.businessDate ? 1 : -1));
}

export type AttendanceView = "day" | "week" | "month";

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;

const startOf = (view: "week" | "month", iso: string) =>
  view === "week" ? startOfWeek(iso) : monthStart(iso);

export function holdsToday(view: "week" | "month", anchor: string, today: string): boolean {
  return startOf(view, anchor) === startOf(view, today);
}

/**
 * The anchor one week or one month over: the range's first day, or today when the range holds
 * it, or null for a range still to come.
 */
export function stepRange(
  view: "week" | "month",
  anchor: string,
  delta: -1 | 1,
  today: string
): string | null {
  const next =
    view === "week"
      ? addDays(startOfWeek(anchor), delta * 7)
      : isoDay(addMonths(yearMonthOf(anchor), delta), 1);
  if (next > today) return null;
  return holdsToday(view, next, today) ? today : next;
}
