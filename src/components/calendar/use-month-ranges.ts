import { useMemo } from "react";

import {
  bankHolidaysToRanges,
  groupConsecutiveByRunKey,
  type CalendarRange,
} from "@/lib/calendar/lanes";
import { gridRange } from "@/lib/calendar/month-grid";
import {
  type RequestListScope,
  useCalendarBankHolidays,
  useCalendarVacations,
  type WireRecordType,
} from "@/lib/local-store";
import type { YearMonth } from "@/lib/requests/months";

export function useMonthRanges(
  month: YearMonth,
  scope: RequestListScope,
  filter: ReadonlySet<WireRecordType>
): CalendarRange[] {
  const range = gridRange(month);
  const rows = useCalendarVacations({ range, scope });
  const holidays = useCalendarBankHolidays({ range, scope });

  return useMemo(
    () =>
      [...groupConsecutiveByRunKey(rows), ...bankHolidaysToRanges(holidays)].filter((bar) =>
        filter.has(bar.type)
      ),
    [rows, holidays, filter]
  );
}
