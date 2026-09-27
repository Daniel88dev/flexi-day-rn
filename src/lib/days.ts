const DAY_MS = 86_400_000;

/** Days since the epoch for an ISO date, so two dates subtract to the days between them. */
export function dayNumber(iso: string): number {
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date((dayNumber(iso) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** A day's place in a Monday-first week: 0 for Monday, 6 for Sunday. */
export function mondayIndex(iso: string): number {
  // Day 0 of the epoch was a Thursday.
  return (((dayNumber(iso) + 3) % 7) + 7) % 7;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The phone's own calendar day of a moment, which is the one the person means. */
export function dayOfDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midday, so no time zone shift can move the day a picker shows. */
export function dateOfDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12);
}
