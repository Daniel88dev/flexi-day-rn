/** A calendar month, `month` 1-based the way the web and the backend count it. */
export type YearMonth = { year: number; month: number };

export type MonthBounds = { first: YearMonth; last: YearMonth };

const index = ({ year, month }: YearMonth) => year * 12 + (month - 1);

export function currentMonth(today: Date): YearMonth {
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

/**
 * The sync pull reaches back to January of last year, so the store holds nothing earlier. Forward,
 * nothing can be booked past December of next year.
 */
export function requestMonthBounds(today: Date): MonthBounds {
  const year = today.getFullYear();
  return { first: { year: year - 1, month: 1 }, last: { year: year + 1, month: 12 } };
}

export function addMonths(current: YearMonth, delta: number): YearMonth {
  const next = index(current) + delta;
  return { year: Math.floor(next / 12), month: (next % 12) + 1 };
}

/** The month `delta` away, or null when it falls outside the bounds. */
export function stepMonth(
  current: YearMonth,
  delta: number,
  bounds: MonthBounds
): YearMonth | null {
  const next = addMonths(current, delta);
  if (index(next) < index(bounds.first) || index(next) > index(bounds.last)) return null;
  return next;
}

export function monthOffset(month: YearMonth, bounds: MonthBounds): number {
  return index(month) - index(bounds.first);
}

export function monthsWithin(bounds: MonthBounds): YearMonth[] {
  const count = monthOffset(bounds.last, bounds) + 1;
  return Array.from({ length: count }, (_, offset) => addMonths(bounds.first, offset));
}

export function isoDay({ year, month }: YearMonth, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The month as `YYYY-MM-DD` days, from its first up to, not including, the next month's first. */
export function monthRange(month: YearMonth): { from: string; until: string } {
  return { from: isoDay(month, 1), until: isoDay(addMonths(month, 1), 1) };
}
