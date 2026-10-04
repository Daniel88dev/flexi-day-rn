import type { CalendarRecordType } from "@/lib/local-store";

import type { ReportSummaryRow } from "./types";

const LEADING: readonly CalendarRecordType[] = [
  "VACATION",
  "HOME_OFFICE",
  "SICK_DAY",
  "SICK",
  "PAID_TIME_OFF",
];

const rank = (type: CalendarRecordType) => {
  const index = LEADING.indexOf(type);
  return index === -1 ? LEADING.length : index;
};

/**
 * The allowances the summary has lines for, the common ones first and the rest in the order the
 * summary lists them. An empty summary still gives Vacation, so a screen always has one type.
 */
export function activeRecordTypes(summary: ReportSummaryRow[]): CalendarRecordType[] {
  const types: CalendarRecordType[] = [];
  for (const row of summary) if (!types.includes(row.vacationType)) types.push(row.vacationType);
  if (types.length === 0) return ["VACATION"];
  return types.sort((a, b) => rank(a) - rank(b));
}
