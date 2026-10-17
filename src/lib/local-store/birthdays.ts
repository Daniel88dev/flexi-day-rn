import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { birthdayOccurrences } from "@/lib/birthdays/birthday";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import type { CalendarQuery } from "./calendar";
import { birthdays, groupUsers, users } from "./schema";

/** One birthday on one calendar day. `age` is the age turned that day, null without a year. */
export type CalendarBirthday = {
  userId: string;
  userName: string | null;
  date: string;
  age: number | null;
  own: boolean;
};

/**
 * Mine shows the viewer's own birthday only (S7). Group adds the shared birthdays of the group's
 * live members, read through the store's own memberships: a colleague who left drops out here
 * before the next snapshot sweeps their row.
 */
export function calendarBirthdays(
  db: StoreDatabase,
  { range, scope }: CalendarQuery
): CalendarBirthday[] {
  const viewerId = readSyncState(db)?.userId ?? "";
  const own = eq(birthdays.userId, viewerId);
  const who =
    scope.kind === "mine"
      ? own
      : or(
          own,
          and(
            eq(birthdays.shared, true),
            inArray(
              birthdays.userId,
              db
                .select({ userId: groupUsers.userId })
                .from(groupUsers)
                .where(and(eq(groupUsers.groupId, scope.groupId), isNull(groupUsers.deletedAt)))
            )
          )
        );

  const rows = db
    .select({
      userId: birthdays.userId,
      month: birthdays.month,
      day: birthdays.day,
      year: birthdays.year,
      userName: users.name,
    })
    .from(birthdays)
    .leftJoin(users, eq(users.id, birthdays.userId))
    .where(
      and(who, isNull(birthdays.deletedAt), isNotNull(birthdays.month), isNotNull(birthdays.day))
    )
    .all();

  return rows
    .flatMap((row) =>
      birthdayOccurrences({ month: row.month!, day: row.day!, year: row.year }, range).map(
        (occurrence) => ({
          userId: row.userId,
          userName: row.userName,
          ...occurrence,
          own: row.userId === viewerId,
        })
      )
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || (a.userName ?? "").localeCompare(b.userName ?? "")
    );
}
