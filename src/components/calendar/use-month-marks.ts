import { useMemo } from "react";

import { dayMarkCounts, type DayMarks, type EventSpan } from "@/lib/calendar/day-mark";
import { gridRange } from "@/lib/calendar/month-grid";
import {
  useCalendarBirthdays,
  useCalendarGroupEvents,
  type RequestListScope,
} from "@/lib/local-store";
import type { YearMonth } from "@/lib/requests/months";

/**
 * The marks a month's grid carries, adjacent days included, and the group event occurrences that
 * draw its ribbons. Birthdays and group events ignore the type filter.
 */
export function useMonthMarks(
  month: YearMonth,
  scope: RequestListScope
): { marks: DayMarks; eventSpans: readonly EventSpan[] } {
  const range = gridRange(month);
  const birthdays = useCalendarBirthdays({ range, scope });
  const events = useCalendarGroupEvents({ range, scope });
  return useMemo(
    () => ({ marks: dayMarkCounts({ birthdays, events }), eventSpans: events }),
    [birthdays, events]
  );
}
