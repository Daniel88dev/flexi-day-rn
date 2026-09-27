import { addDays } from "@/lib/days";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// An impossible day such as 2026-02-30 rolls over on the way through, and 2026-13-45 is no date.
function isCalendarDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  try {
    return addDays(value, 0) === value;
  } catch {
    return false;
  }
}

/** The day a `?date=` link opens on: a real day already begun, or else today. */
export function linkedDay(param: string | null | undefined, today: string): string {
  if (!param || !isCalendarDay(param) || param > today) return today;
  return param;
}

/** The day `delta` away, or null when it would be a day still to come. */
export function stepDay(anchor: string, delta: -1 | 1, today: string): string | null {
  const next = addDays(anchor, delta);
  return next > today ? null : next;
}
