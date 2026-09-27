import type { AttendanceMonth } from "@/lib/attendance/types";
import { weekdayOf } from "@/lib/days";

const sorted = (days: Iterable<number>) => [...new Set(days)].sort((a, b) => a - b);

/**
 * The organization's working weekdays as `Date.getDay()` numbers. `/month` carries no list of
 * them, but a day off or a holiday still falls on a working day, while a weekday nobody works
 * only ever reads as a non-working day.
 */
export function workingWeekdays(months: readonly AttendanceMonth[]): number[] | null {
  if (months.length === 0) return null;
  const worked = months.flatMap((month) =>
    month.days
      .filter(
        (day) =>
          day.exclusion === null ||
          day.exclusion.cause === "HOLIDAY" ||
          day.exclusion.cause === "ABSENCE"
      )
      .map((day) => weekdayOf(day.businessDate))
  );
  return sorted(worked);
}

export function tickedWeekdays(picked: number[] | null, working: readonly number[]): number[] {
  return picked ?? [...working];
}

export function toggleWeekday(
  picked: number[] | null,
  working: readonly number[],
  weekday: number
): number[] {
  const ticked = tickedWeekdays(picked, working);
  return ticked.includes(weekday)
    ? ticked.filter((day) => day !== weekday)
    : sorted([...ticked, weekday]);
}
