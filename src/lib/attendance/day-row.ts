import type { Dictionary } from "@/i18n";

import { exclusionLabel } from "./figures";
import { formatMinutes } from "./format";
import type { AttendanceBalanceMode, AttendanceMonthDay } from "./types";

export type RowChip =
  | { kind: "balance"; minutes: number }
  | { kind: "auto-closed" }
  | { kind: "excluded-day" }
  | { kind: "changed" }
  | { kind: "still-open"; overdue: boolean }
  | { kind: "entered" }
  | { kind: "tag"; label: string };

export type DayRow = {
  /** Null on a day off nobody worked, which has only a reason to show. */
  worked: string | null;
  detail: string;
  present: string | null;
  chips: RowChip[];
  hatched: boolean;
  toCome: boolean;
};

/**
 * One day of the Week or the Month, from its `/month` entry. The balance chip shows only in
 * DAILY mode: in MONTHLY the month's balance is the only one on the page.
 */
export function dayRow(
  day: AttendanceMonthDay,
  mode: AttendanceBalanceMode,
  today: string,
  t: Dictionary
): DayRow {
  const exclusion = day.exclusion ?? null;
  const hatched = exclusion?.extent === "FULL";
  const required = formatMinutes(day.requiredMinutes);

  const chips: RowChip[] = [];
  if (mode === "DAILY" && day.balanceMinutes !== null) {
    chips.push({ kind: "balance", minutes: day.balanceMinutes });
  }
  if (day.autoClosed) chips.push({ kind: "auto-closed" });
  if (day.excludedClockIn) chips.push({ kind: "excluded-day" });
  if (day.changedAfterDay) chips.push({ kind: "changed" });
  if (day.open) chips.push({ kind: "still-open", overdue: day.businessDate !== today });
  if (day.entered) chips.push({ kind: "entered" });
  if (exclusion !== null && !hatched)
    chips.push({ kind: "tag", label: exclusionLabel(t, exclusion) });

  return {
    worked: hatched && day.presenceMinutes === 0 ? null : formatMinutes(day.workedMinutes),
    detail:
      exclusion === null
        ? t.attendance.ofRequired(required)
        : hatched
          ? exclusionLabel(t, exclusion)
          : t.attendance.halfDayOf(required),
    present:
      day.presenceMinutes > 0 ? t.attendance.present(formatMinutes(day.presenceMinutes)) : null,
    chips,
    hatched,
    // A day off says so whether or not it has arrived: nothing about it is still to be decided.
    toCome: day.upcoming && !hatched,
  };
}
