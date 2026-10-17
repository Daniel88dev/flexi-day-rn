import { useMemo } from "react";

import { dayMarkCounts, type DayMarks } from "@/lib/calendar/day-mark";
import { gridRange } from "@/lib/calendar/month-grid";
import { useCalendarBirthdays, type RequestListScope } from "@/lib/local-store";
import type { YearMonth } from "@/lib/requests/months";

/** The marks a month's grid carries, adjacent days included. Birthdays ignore the type filter. */
export function useMonthMarks(month: YearMonth, scope: RequestListScope): DayMarks {
  const birthdays = useCalendarBirthdays({ range: gridRange(month), scope });
  return useMemo(() => dayMarkCounts({ birthdays }), [birthdays]);
}
