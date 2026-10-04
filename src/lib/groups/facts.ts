import type { HolidayCountry } from "@/lib/query";

/** The week Monday first, as `Date.getDay()` numbers, which is how groups store working days. */
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

export function weekdayPills(
  workingDays: readonly number[]
): { weekday: number; working: boolean }[] {
  return WEEK.map((weekday) => ({ weekday, working: workingDays.includes(weekday) }));
}

/** Consecutive working days as positions in the week, Monday 0, so they read as "Mon to Fri". */
export type WeekdayRun = { from: number; to: number };

export function workingDayRuns(workingDays: readonly number[]): WeekdayRun[] {
  const runs: WeekdayRun[] = [];
  weekdayPills(workingDays).forEach(({ working }, position) => {
    if (!working) return;
    const last = runs.at(-1);
    if (last && last.to === position - 1) last.to = position;
    else runs.push({ from: position, to: position });
  });
  return runs;
}

/** Null when the group has no holiday country. */
export function holidayCountryLabel(
  code: string | null,
  countries: readonly HolidayCountry[] | undefined
): string | null {
  if (code === null) return null;
  return countries?.find((country) => country.code === code)?.name ?? code;
}
