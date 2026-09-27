import { useMemo } from "react";

import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { DayList } from "@/components/calendar/day-list";
import { useTranslation } from "@/i18n/use-translation";
import { dayEntries, dayWindow } from "@/lib/calendar/day";
import {
  useCalendarBankHolidays,
  useCalendarVacations,
  type CalendarRecordType,
  type RequestListScope,
} from "@/lib/local-store";

type DayProps = {
  scope: RequestListScope;
  filter: ReadonlySet<CalendarRecordType>;
  viewerId: string | null;
  onOpen?: (vacationId: string) => void;
  onBook: (day: string) => void;
};

function DaySheetList({
  day,
  scope,
  filter,
  viewerId,
  onOpen,
  onBook,
}: DayProps & { day: string }) {
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

export function DaySheet({
  day,
  onClose,
  ...props
}: DayProps & { day: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={day !== null}
      onClose={onClose}
      closeLabel={t.account.cancel}
      testID="day-sheet"
    >
      {day ? <DaySheetList day={day} {...props} /> : null}
    </BottomSheet>
  );
}
