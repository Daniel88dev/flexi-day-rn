import type { DayMonth } from "@/i18n/en";
import { addDays, mondayIndex } from "@/lib/days";
import { isoDay, type YearMonth } from "@/lib/requests/months";
import type {
  CalendarRecordType,
  DayRange,
  ListedVacation,
  VacationStatus,
} from "@/lib/local-store";

/** `from` and `to` span the request the day belongs to. */
export type DayEntry = {
  vacationId: string;
  userId: string;
  userName: string | null;
  type: CalendarRecordType;
  status: VacationStatus;
  halfDay: boolean;
  from: string;
  to: string;
  /** A pending change or a Provisional row holds it, so it opens nothing yet. */
  pending: boolean;
};

/** How far either side of a day the day list reads to find where its requests start and end. */
export function dayWindow(day: string): DayRange {
  return { from: addDays(day, -62), until: addDays(day, 63) };
}

/** Everyone out on `day`, the viewer first. A request partly decided spans its days per status. */
export function dayEntries(
  rows: readonly ListedVacation[],
  day: string,
  viewerId: string | null
): DayEntry[] {
  const spanKey = (row: ListedVacation) => `${row.requestId}|${row.userId}|${row.status}`;
  const spans = new Map<string, { from: string; to: string }>();
  for (const row of rows) {
    const span = spans.get(spanKey(row));
    spans.set(spanKey(row), {
      from: span && span.from < row.requestedDay ? span.from : row.requestedDay,
      to: span && span.to > row.requestedDay ? span.to : row.requestedDay,
    });
  }

  const rank = (entry: DayEntry) => (entry.userId === viewerId ? 0 : 1);
  return rows
    .filter((row) => row.requestedDay === day)
    .map((row) => ({
      vacationId: row.id,
      userId: row.userId,
      userName: row.userName,
      type: row.vacationType,
      status: row.status,
      halfDay: row.halfDay,
      pending: row.pending,
      ...spans.get(spanKey(row))!,
    }))
    .sort((a, b) => rank(a) - rank(b) || (a.userName ?? "").localeCompare(b.userName ?? ""));
}

/** `weekday` counts from Monday as 0. */
export function dayParts(day: string): { weekday: number; date: DayMonth } {
  return {
    weekday: mondayIndex(day),
    date: { day: Number(day.slice(8, 10)), month: Number(day.slice(5, 7)) },
  };
}

/** The day the stripes' day card shows on a month: today if it is in it, otherwise the 1st. */
export function openingDay(month: YearMonth, today: string): string {
  const first = isoDay(month, 1);
  return today.slice(0, 7) === first.slice(0, 7) ? today : first;
}
