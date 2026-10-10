import { addDays, mondayIndex } from "@/lib/days";
import type { DayRange } from "@/lib/local-store";
import { monthRange, type YearMonth } from "@/lib/requests/months";

/** An adjacent day, outside the month, still carries its real date. */
export type GridDay = { date: string; day: number; inMonth: boolean };

/** Seven days, Monday first. */
export type Week = GridDay[];

/** Whole Monday-first weeks covering `first` through `last`, both inclusive. */
export function weeksCovering(first: string, last: string): string[][] {
  const start = addDays(first, -mondayIndex(first));
  const end = addDays(last, 6 - mondayIndex(last));
  const weeks: string[][] = [];
  for (let monday = start; monday <= end; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, column) => addDays(monday, column)));
  }
  return weeks;
}

export function monthWeeks(month: YearMonth): Week[] {
  const { from, until } = monthRange(month);
  return weeksCovering(from, addDays(until, -1)).map((week) =>
    week.map((date) => ({
      date,
      day: Number(date.slice(8, 10)),
      inMonth: date >= from && date < until,
    }))
  );
}

/** The days the month's grid shows, from its first cell up to, not including, the day after its last. */
export function gridRange(month: YearMonth): DayRange {
  const weeks = monthWeeks(month);
  return { from: weeks[0][0].date, until: addDays(weeks[weeks.length - 1][6].date, 1) };
}

export function seamColumn(week: Week): number | null {
  const column = week.findIndex(
    (cell, index) => index > 0 && cell.inMonth !== week[index - 1].inMonth
  );
  return column >= 0 ? column : null;
}

export function monthLabelColumn(week: Week): number | null {
  const column = week.findIndex((cell) => !cell.inMonth);
  return column >= 0 ? column : null;
}
