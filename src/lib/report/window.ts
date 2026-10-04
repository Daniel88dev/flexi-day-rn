import type { MonthlyUsage, ReportPeriod } from "./types";

export type MonthSlot = { year: number; month: number };

/** An overview row carries a month but no year, so a window across New Year stamps it back on. */
export type DatedUsage = MonthlyUsage & { year: number };

export function calendarMonths(year: number): MonthSlot[] {
  return Array.from({ length: 12 }, (_, index) => ({ year, month: index + 1 }));
}

export function trailingMonths(today: Date, count = 12): MonthSlot[] {
  const slots: MonthSlot[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const date = new Date(today.getFullYear(), today.getMonth() - back, 1);
    slots.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
  }
  return slots;
}

export function periodSlots(period: ReportPeriod, today: Date): MonthSlot[] {
  return period === "rolling" ? trailingMonths(today) : calendarMonths(period);
}

export function periodYear(period: ReportPeriod, today: Date): number {
  return period === "rolling" ? today.getFullYear() : period;
}

export function yearsInWindow(slots: MonthSlot[]): number[] {
  return Array.from(new Set(slots.map((slot) => slot.year))).sort((a, b) => a - b);
}

export function priorYearRead(
  slots: MonthSlot[],
  year: number,
  scopeYears: number[] | undefined
): { priorYear: number; spansYears: boolean; needsPrior: boolean } {
  const priorYear = year - 1;
  const spansYears = slots.some((slot) => slot.year === priorYear);
  return {
    priorYear,
    spansYears,
    needsPrior: spansYears && (scopeYears ?? []).includes(priorYear),
  };
}

export function withYear(year: number, rows: MonthlyUsage[]): DatedUsage[] {
  return rows.map((row) => ({ ...row, year }));
}

export function windowLabel(
  slots: MonthSlot[],
  monthsShort: readonly string[],
  range: (from: string, to: string) => string
): string {
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (!first || !last) return "";
  if (first.year === last.year && first.month === 1 && last.month === 12) {
    return String(first.year);
  }
  const name = (slot: MonthSlot) => `${monthsShort[slot.month - 1] ?? slot.month} ${slot.year}`;
  return range(name(first), name(last));
}

export function axisLabel(
  slots: MonthSlot[],
  index: number,
  monthsShort: readonly string[]
): { month: string; year?: string } {
  const slot = slots[index];
  if (!slot) return { month: "" };
  const month = monthsShort[slot.month - 1] ?? String(slot.month);
  if (yearsInWindow(slots).length < 2) return { month };
  if (index === 0 || slot.month === 1) return { month, year: `'${String(slot.year).slice(-2)}` };
  return { month };
}
