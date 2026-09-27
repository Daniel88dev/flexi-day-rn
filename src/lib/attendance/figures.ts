import type { Dictionary } from "@/i18n";

import { formatMinutes } from "./format";
import type { AttendanceBalanceMode, AttendanceExclusion, AttendanceMonthDay } from "./types";

export function exclusionLabel(t: Dictionary, exclusion: AttendanceExclusion): string {
  const label = (() => {
    switch (exclusion.cause) {
      case "NOT_EMPLOYED":
        return t.attendance.notEmployed;
      case "NON_WORKING_DAY":
        return t.attendance.nonWorkingDay;
      case "HOLIDAY":
        return exclusion.label ?? t.attendance.publicHoliday;
      case "ABSENCE":
        return exclusion.label
          ? (t.recordTypes[exclusion.label as keyof Dictionary["recordTypes"]] ?? exclusion.label)
          : t.attendance.absent;
      default:
        // A newer backend can send a cause this build has never heard of.
        return t.attendance.dayOff;
    }
  })();
  return exclusion.extent === "HALF" ? t.attendance.halfDayTag(label) : label;
}

export type FiguresLine = { text: string; balance: number | null; tag: string | null };

/**
 * The line under the Day view's totals, from the day's `/month` entry: worked against required,
 * the balance where the mode shows one per day, and why less or nothing was owed.
 */
export function figuresLine(
  day: AttendanceMonthDay,
  mode: AttendanceBalanceMode,
  t: Dictionary
): FiguresLine {
  const balance = mode === "DAILY" ? day.balanceMinutes : null;
  const worked = formatMinutes(day.workedMinutes);
  const exclusion = day.exclusion ?? null;

  if (exclusion === null) {
    return {
      text: t.attendance.workedOf(worked, formatMinutes(day.requiredMinutes)),
      balance,
      tag: null,
    };
  }
  const reason = exclusionLabel(t, exclusion);
  if (exclusion.extent === "HALF") {
    return {
      text: t.attendance.workedOf(worked, formatMinutes(day.requiredMinutes)),
      balance,
      tag: reason,
    };
  }
  if (day.presenceMinutes === 0) return { text: reason, balance, tag: null };
  return { text: t.attendance.worked(worked), balance, tag: reason };
}
