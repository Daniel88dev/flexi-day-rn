import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { addDays } from "@/lib/days";
import { occurrences, repeatRuleOf, type RepeatRule } from "@/lib/group-events/occurrences";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import type { CalendarQuery } from "./calendar";
import { groupEvents, groupUsers, groups, users } from "./schema";

/** One occurrence of a group event, both ends inclusive, with what its card shows. */
export type CalendarGroupEvent = {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  note: string | null;
  startDate: string;
  endDate: string;
  /** `HH:MM`; both null on an all-day event. */
  startTime: string | null;
  endTime: string | null;
  repeat: RepeatRule | null;
  /** The recurring group event's own start, which its rule is read off. */
  ruleStartDate: string;
  /** A one-off that replaced one occurrence of a recurring group event. */
  changedOnce: boolean;
  /** Null once the creator's account is gone. */
  creator: { id: string; name: string } | null;
};

/**
 * Mine shows the events of every group the viewer is a live member of, Group the chosen group's.
 * Each recurring group event expands into its occurrences in the range. What the viewer may do
 * with one is the server's answer, never these rows.
 */
export function calendarGroupEvents(
  db: StoreDatabase,
  { range, scope }: CalendarQuery
): CalendarGroupEvent[] {
  const viewerId = readSyncState(db)?.userId ?? "";
  const viewerGroups = db
    .select({ groupId: groupUsers.groupId })
    .from(groupUsers)
    .where(and(eq(groupUsers.userId, viewerId), isNull(groupUsers.deletedAt)));
  const inScope =
    scope.kind === "group"
      ? eq(groupEvents.groupId, scope.groupId)
      : inArray(groupEvents.groupId, viewerGroups);

  const rows = db
    .select({ event: groupEvents, groupName: groups.groupName, creatorName: users.name })
    .from(groupEvents)
    .innerJoin(groups, eq(groups.id, groupEvents.groupId))
    .leftJoin(users, eq(users.id, groupEvents.createdByUserId))
    .where(
      and(
        inScope,
        isNull(groupEvents.deletedAt),
        isNotNull(groupEvents.title),
        isNull(groups.deletedAt)
      )
    )
    .all();
  if (rows.length === 0) return [];

  const last = addDays(range.until, -1);

  return rows
    .flatMap(({ event, groupName, creatorName }) => {
      const repeat = repeatRuleOf(event);
      const creator = event.createdByUserId
        ? { id: event.createdByUserId, name: creatorName ?? "?" }
        : null;

      return occurrences(
        {
          startDate: event.startDate,
          endDate: event.endDate,
          repeat,
          skippedDates: event.skippedDates,
        },
        range.from,
        last
      ).map<CalendarGroupEvent>((occurrence) => ({
        id: event.id,
        groupId: event.groupId,
        groupName,
        title: event.title ?? "",
        note: event.note,
        ...occurrence,
        startTime: event.startTime,
        endTime: event.endTime,
        repeat,
        ruleStartDate: event.startDate,
        changedOnce: event.recurringEventId !== null,
        creator,
      }));
    })
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.title.localeCompare(b.title)
    );
}
