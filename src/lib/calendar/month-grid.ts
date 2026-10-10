import { addDays, mondayIndex } from "@/lib/days";
import { monthRange, type YearMonth } from "@/lib/requests/months";

/** A padding cell outside the month still carries its real date. */
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
