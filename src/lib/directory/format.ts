import type { DirectoryLabel } from "./types";

/** An archived Department or Location reads as the web shows it, "Name (archived)". */
export const labelName = (label: DirectoryLabel, archived: (name: string) => string) =>
  label.archived ? archived(label.name) : label.name;

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "30 Jun 2026" on the device's calendar, in the dictionary's locale. A `YYYY-MM-DD` names a
 * calendar day, so it is read as that day wherever the phone is, not as UTC midnight.
 */
export function directoryDate(locale: string, value: string): string {
  const day = CALENDAR_DAY.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
