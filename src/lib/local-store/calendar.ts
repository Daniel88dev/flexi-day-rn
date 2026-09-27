import { and, asc, eq, gte, inArray, isNull, lt } from "drizzle-orm";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import type { PendingChange } from "./pending";
import type { DayRange } from "./queries";
import { scopedVacations, type ListedVacation, type RequestListScope } from "./requests";
import { bankHolidays, groups, groupUsers } from "./schema";

export type CalendarQuery = { range: DayRange; scope: RequestListScope };

export type CalendarBankHoliday = { date: string; name: string };

/** What the dashboard calendar draws: rejected and cancelled rows are hidden. */
export function calendarVacations(
  db: StoreDatabase,
  changes: readonly PendingChange[],
  { range, scope }: CalendarQuery
): ListedVacation[] {
  return scopedVacations(db, changes, scope, range).filter(
    (row) => row.status === "pending" || row.status === "approved"
  );
}

/** Every country across the viewer's groups for Mine; the chosen group's country for Group. */
function holidayCountries(db: StoreDatabase, scope: RequestListScope): string[] {
  const where =
    scope.kind === "group"
      ? eq(groups.id, scope.groupId)
      : inArray(
          groups.id,
          db
            .select({ groupId: groupUsers.groupId })
            .from(groupUsers)
            .where(
              and(
                eq(groupUsers.userId, readSyncState(db)?.userId ?? ""),
                isNull(groupUsers.deletedAt)
              )
            )
        );

  const rows = db
    .select({ country: groups.holidayCountry })
    .from(groups)
    .where(and(where, isNull(groups.deletedAt)))
    .all();
  return [...new Set(rows.map((row) => row.country).filter((c): c is string => Boolean(c)))];
}

export function calendarBankHolidays(
  db: StoreDatabase,
  { range, scope }: CalendarQuery
): CalendarBankHoliday[] {
  const countries = holidayCountries(db, scope);
  if (countries.length === 0) return [];

  return db
    .select({ date: bankHolidays.date, name: bankHolidays.name })
    .from(bankHolidays)
    .where(
      and(
        inArray(bankHolidays.country, countries),
        gte(bankHolidays.date, range.from),
        lt(bankHolidays.date, range.until)
      )
    )
    .orderBy(asc(bankHolidays.date), asc(bankHolidays.name))
    .all();
}
