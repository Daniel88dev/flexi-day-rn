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
  /** Null once the creator's account is gone (S5). `member`: still in the group. */
  creator: { id: string; name: string; member: boolean } | null;
  /** S2 as the phone can see it: the creator while a member, or a group admin or manager. */
  canEdit: boolean;
};

type Membership = { groupId: string; adminAccess: boolean };

function liveMemberships(db: StoreDatabase, userIds: string[]): Map<string, Membership[]> {
  if (userIds.length === 0) return new Map();
  const rows = db
    .select({
      userId: groupUsers.userId,
      groupId: groupUsers.groupId,
      adminAccess: groupUsers.adminAccess,
    })
    .from(groupUsers)
    .where(and(inArray(groupUsers.userId, userIds), isNull(groupUsers.deletedAt)))
    .all();
  const byUser = new Map<string, Membership[]>();
  for (const row of rows) {
    byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  }
  return byUser;
}

/**
 * Mine shows the events of every group the viewer is a live member of, Group the chosen group's.
 * Each recurring group event expands into its occurrences in the range.
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
    .select({
      event: groupEvents,
      groupName: groups.groupName,
      managerUserId: groups.managerUserId,
      creatorName: users.name,
    })
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

  const creatorIds = rows.flatMap(({ event }) =>
    event.createdByUserId ? [event.createdByUserId] : []
  );
  const memberships = liveMemberships(db, [...new Set([viewerId, ...creatorIds])]);
  const memberOf = (userId: string, groupId: string) =>
    memberships.get(userId)?.find((membership) => membership.groupId === groupId);
  const last = addDays(range.until, -1);

  return rows
    .flatMap(({ event, groupName, managerUserId, creatorName }) => {
      const repeat = repeatRuleOf(event);
      const viewer = memberOf(viewerId, event.groupId);
      const creator = event.createdByUserId
        ? {
            id: event.createdByUserId,
            name: creatorName ?? "?",
            member: memberOf(event.createdByUserId, event.groupId) !== undefined,
          }
        : null;
      const canEdit =
        managerUserId === viewerId ||
        viewer?.adminAccess === true ||
        (creator?.id === viewerId && creator.member);

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
        canEdit,
      }));
    })
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.title.localeCompare(b.title)
    );
}
