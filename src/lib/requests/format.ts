import type { DayMonth } from "@/i18n/en";

type DayLengthSource = { halfDay: boolean; startTime: string | null; endTime: string | null };

/** `halfDay` alone decides the length; times are shown beside it, as the web does. */
export function dayLengthLabel(
  entry: DayLengthSource,
  labels: { halfDay: string; fullDay: string }
): string {
  if (entry.startTime && entry.endTime) {
    const range = `${entry.startTime.slice(0, 5)}-${entry.endTime.slice(0, 5)}`;
    return entry.halfDay ? `${labels.halfDay} · ${range}` : range;
  }
  return entry.halfDay ? labels.halfDay : labels.fullDay;
}

function dayMonth(iso: string): DayMonth {
  return { day: Number(iso.slice(8, 10)), month: Number(iso.slice(5, 7)) };
}

export function runDatesLabel(
  run: { from: string; to: string },
  format: (from: DayMonth, to: DayMonth) => string
): string {
  return format(dayMonth(run.from), dayMonth(run.to));
}
