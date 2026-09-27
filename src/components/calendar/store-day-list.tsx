import { useMemo } from "react";

import { DayList } from "@/components/calendar/day-list";
import { dayEntries, dayWindow } from "@/lib/calendar/day";
import {
  useCalendarBankHolidays,
  useCalendarVacations,
  type CalendarRecordType,
  type RequestListScope,
} from "@/lib/local-store";

export type StoreDayListProps = {
  scope: RequestListScope;
  filter: ReadonlySet<CalendarRecordType>;
  viewerId: string | null;
  onOpen?: (vacationId: string) => void;
  onBook: (day: string) => void;
};

/** The day list over the Local store's rows for the scope and filter the calendar shows. */
export function StoreDayList({
  day,
  scope,
  filter,
  viewerId,
  onOpen,
  onBook,
}: StoreDayListProps & { day: string }) {
  const range = dayWindow(day);
  const rows = useCalendarVacations({ range, scope });
  const holidays = useCalendarBankHolidays({ range, scope });

  const entries = useMemo(
    () =>
      dayEntries(
        rows.filter((row) => filter.has(row.vacationType)),
        day,
        viewerId
      ),
    [rows, filter, day, viewerId]
  );
  const names = filter.has("BANK_HOLIDAY")
    ? holidays.filter((holiday) => holiday.date === day).map((holiday) => holiday.name)
    : [];

  return (
    <DayList
      day={day}
      entries={entries}
      holidays={[...new Set(names)]}
      viewerId={viewerId}
      onOpen={onOpen}
      onBook={onBook}
    />
  );
}
