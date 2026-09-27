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
