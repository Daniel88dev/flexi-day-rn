// PROTOTYPE (T-265): the month query widened to the padded grid, plus boundary fixtures.
import { useMemo } from "react";

import {
  paddedRange,
  protoBankRanges,
  protoFixtures,
  protoGroupRows,
  type ProtoRange,
} from "@/lib/calendar/prototype-adjacent";
import {
  useCalendarBankHolidays,
  useCalendarVacations,
  type CalendarRecordType,
  type RequestListScope,
} from "@/lib/local-store";
import type { YearMonth } from "@/lib/requests/months";
import { useViewer } from "@/lib/viewer/use-viewer";

export function useProtoMonthRanges(
  month: YearMonth,
  scope: RequestListScope,
  filter: ReadonlySet<CalendarRecordType>,
  syncedFrom: string
): ProtoRange[] {
  const range = paddedRange(month);
  const rows = useCalendarVacations({ range, scope });
  const holidays = useCalendarBankHolidays({ range, scope });
  const viewer = useViewer();
  const viewerId = viewer?.id ?? null;
  const viewerName = viewer?.name ?? null;
  const { year, month: monthNumber } = month;

  return useMemo(
    () =>
      [
        ...protoGroupRows(rows),
        ...protoBankRanges(holidays),
        ...protoFixtures(
          { year, month: monthNumber },
          { id: viewerId, name: viewerName },
          syncedFrom
        ),
      ].filter((bar) => filter.has(bar.type)),
    [rows, holidays, year, monthNumber, filter, viewerId, viewerName, syncedFrom]
  );
}
