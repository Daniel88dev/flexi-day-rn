import { useMemo } from "react";

import {
  bankHolidaysToRanges,
  groupConsecutiveByRunKey,
  type CalendarRange,
} from "@/lib/calendar/lanes";
import {
  useCalendarBankHolidays,
  useCalendarVacations,
  type CalendarRecordType,
  type RequestListScope,
} from "@/lib/local-store";
import { monthRange, type YearMonth } from "@/lib/requests/months";

export function useMonthRanges(
  month: YearMonth,
  scope: RequestListScope,
  filter: ReadonlySet<CalendarRecordType>
): CalendarRange[] {
  const range = monthRange(month);
  const rows = useCalendarVacations({ range, scope });
  const holidays = useCalendarBankHolidays({ range, scope });
  const { year, month: monthNumber } = month;

  return useMemo(
    () =>
      [
        ...groupConsecutiveByRunKey(rows),
        ...bankHolidaysToRanges(holidays, { year, month: monthNumber }),
      ].filter((bar) => filter.has(bar.type)),
    [rows, holidays, year, monthNumber, filter]
  );
}
