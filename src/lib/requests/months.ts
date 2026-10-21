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

export function monthOf(day: string): YearMonth {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

export function isoDay({ year, month }: YearMonth, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The month as `YYYY-MM-DD` days, from its first up to, not including, the next month's first. */
export function monthRange(month: YearMonth): { from: string; until: string } {
  return monthWindowRange({ first: month, length: 1 });
}

export const MONTH_WINDOW_LENGTHS = [1, 3, 6] as const;

export type MonthWindowLength = (typeof MONTH_WINDOW_LENGTHS)[number];

export type MonthWindow = { first: YearMonth; length: MonthWindowLength };

export function defaultMonthWindow(today: Date): MonthWindow {
  return { first: currentMonth(today), length: 3 };
}

function lastOfWindow({ first, length }: MonthWindow): YearMonth {
  return addMonths(first, length - 1);
}

const windowFits = (window: MonthWindow, bounds: MonthBounds) =>
  index(window.first) >= index(bounds.first) && index(lastOfWindow(window)) <= index(bounds.last);

/** The window moved `delta` months, or null when any of it would fall outside the bounds. */
export function shiftMonthWindow(
  window: MonthWindow,
  delta: number,
  bounds: MonthBounds
): MonthWindow | null {
  const next = { first: addMonths(window.first, delta), length: window.length };
  return windowFits(next, bounds) ? next : null;
}

/** The window at a new length, moved back as far as it must be to end inside the bounds. */
export function resizeMonthWindow(
  window: MonthWindow,
  length: MonthWindowLength,
  bounds: MonthBounds
): MonthWindow {
  const latestFirst = addMonths(bounds.last, -(length - 1));
  const first = index(window.first) > index(latestFirst) ? latestFirst : window.first;
  return { first, length };
}

export function monthWindowLabel(window: MonthWindow, monthsShort: readonly string[]): string {
  const last = lastOfWindow(window);
  const name = (month: YearMonth) => monthsShort[month.month - 1];
  if (window.length === 1) return `${name(last)} ${last.year}`;
  if (window.first.year === last.year) return `${name(window.first)} – ${name(last)} ${last.year}`;
  return `${name(window.first)} ${window.first.year} – ${name(last)} ${last.year}`;
}

/** `until` is the first day after the window. */
export function monthWindowRange(window: MonthWindow): { from: string; until: string } {
  return {
    from: isoDay(window.first, 1),
    until: isoDay(addMonths(window.first, window.length), 1),
  };
}

export function sameMonthWindow(a: MonthWindow, b: MonthWindow): boolean {
  return a.length === b.length && index(a.first) === index(b.first);
}
