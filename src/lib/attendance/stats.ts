import type { Dictionary } from "@/i18n";

import { formatMinutes, formatSignedMinutes } from "./format";
import type { AttendanceMonth, AttendanceMonthDay } from "./types";

export type Stat = { label: string; value: string; sub?: string };

/**
 * The Week's card. The week has no totals of its own on the backend, so they are the web's sums
 * of its days: required counts only the days already begun, so the rest of the week is no
 * shortfall.
 */
export function weekStats(days: AttendanceMonthDay[], t: Dictionary): Stat[] {
  const begun = days.filter((day) => !day.upcoming);
  const worked = begun.reduce((total, day) => total + day.workedMinutes, 0);
  const required = begun.reduce((total, day) => total + day.requiredMinutes, 0);
  const flagged = days.filter((day) => day.flagged).length;
  const a = t.attendance;
  return [
    { label: a.statWorked, value: formatMinutes(worked) },
    { label: a.statRequired, value: formatMinutes(required) },
    { label: a.statBalance, value: formatSignedMinutes(worked - required) },
    { label: a.statFlagged, value: String(flagged), sub: a.statDaysToCheck(flagged) },
  ];
}

/** The Month's card, from the month's own totals, following the organization's balance mode. */
export function monthStats(month: AttendanceMonth, t: Dictionary): Stat[] {
  const { totals } = month;
  const a = t.attendance;
  const monthly = month.balanceMode === "MONTHLY";
  // Someone who joined on the 15th reads "2 of 16", not "2 of 30".
  const employedDays = month.days.filter((day) => day.exclusion?.cause !== "NOT_EMPLOYED").length;
  return [
    { label: a.statWorked, value: formatMinutes(totals.workedMinutes) },
    { label: a.statRequiredSoFar, value: formatMinutes(totals.requiredMinutes) },
    {
      label: monthly ? a.statMonthBalance : a.statBalance,
      value: formatSignedMinutes(totals.balanceMinutes),
      sub: a.statAgainstToDate,
    },
    monthly
      ? { label: a.statMonthRequired, value: formatMinutes(totals.requiredRangeMinutes) }
      : {
          label: a.statFlagged,
          value: String(totals.flaggedDays),
          sub: a.statDaysToCheck(totals.flaggedDays),
        },
    {
      label: a.statExcludedDays,
      value: String(totals.excludedDays),
      sub: a.statOfDays(employedDays),
    },
  ];
}
