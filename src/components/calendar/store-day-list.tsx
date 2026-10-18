import { useMemo } from "react";

import { DayList } from "@/components/calendar/day-list";
import { useShownGroupEvents } from "@/components/calendar/use-shown-group-events";
import { dayEntries, dayWindow } from "@/lib/calendar/day";
import { addDays } from "@/lib/days";
import {
  useCalendarBankHolidays,
  useCalendarBirthdays,
  useCalendarGroupEvents,
  useCalendarVacations,
  type CalendarGroupEvent,
  type CalendarRecordType,
  type RequestListScope,
} from "@/lib/local-store";
import { monthOf } from "@/lib/requests/months";

export type StoreDayListProps = {
  scope: RequestListScope;
  filter: ReadonlySet<CalendarRecordType>;
  viewerId: string | null;
  onOpen?: (vacationId: string) => void;
  onBook: (day: string) => void;
  onSettings?: () => void;
  onEvent?: (event: CalendarGroupEvent) => void;
  onNewEvent?: (day: string) => void;
  onEditEvent?: (event: CalendarGroupEvent) => void;
  onDeleteEvent?: (event: CalendarGroupEvent) => void;
};

/** The day list over the Local store's rows for the scope and filter the calendar shows. */
export function StoreDayList({
  day,
  scope,
  filter,
  viewerId,
  onOpen,
  onBook,
  onSettings,
  onEvent,
  onNewEvent,
  onEditEvent,
  onDeleteEvent,
}: StoreDayListProps & { day: string }) {
  const range = dayWindow(day);
  const rows = useCalendarVacations({ range, scope });
  const holidays = useCalendarBankHolidays({ range, scope });
  const today = { from: day, until: addDays(day, 1) };
  const birthdays = useCalendarBirthdays({ range: today, scope });
  const events = useShownGroupEvents(
    useCalendarGroupEvents({ range: today, scope }),
    monthOf(day),
    scope
  );

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
      birthdays={birthdays}
      events={events}
      viewerId={viewerId}
      onOpen={onOpen}
      onBook={onBook}
      onSettings={onSettings}
      onEvent={onEvent}
      onNewEvent={onNewEvent}
      onEditEvent={onEditEvent}
      onDeleteEvent={onDeleteEvent}
    />
  );
}
