import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";

import { addDays } from "@/lib/days";
import { monthRange, type YearMonth } from "@/lib/requests/months";
import { collapseRuns, type RequestRun } from "@/lib/requests/runs";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import type { OverlayEntry } from "./pending";
import { mergedVacations, selectVacations, type DayRange, type MergedVacation } from "./queries";
import { groupMirrors, groups, groupUsers, users, vacations } from "./schema";

export type ListedVacation = MergedVacation & {
  userName: string | null;
  groupName: string | null;
};

export type RequestScopeGroup = { groupId: string; groupName: string };

/** A group seen in full, or the viewer's own rows from every group. */
export type RequestListScope = { kind: "mine" } | { kind: "group"; groupId: string };

export type RequestListQuery = { month: YearMonth; scope: RequestListScope };

/**
 * The groups the viewer sees in full, the backend's report scope `all`: view or admin access on
 * their own membership, or managing the group they belong to. It picks which rows the list shows
 * of what the store already holds; it grants no action.
 */
export function requestScopeGroups(db: StoreDatabase): RequestScopeGroup[] {
  const viewerId = readSyncState(db)?.userId;
  if (!viewerId) return [];

  return db
    .select({ groupId: groups.id, groupName: groups.groupName })
    .from(groupUsers)
    .innerJoin(groups, eq(groupUsers.groupId, groups.id))
    .where(
      and(
        eq(groupUsers.userId, viewerId),
        isNull(groupUsers.deletedAt),
        isNull(groups.deletedAt),
        or(
          eq(groupUsers.viewAccess, true),
          eq(groupUsers.adminAccess, true),
          eq(groups.managerUserId, viewerId)
        )
      )
    )
    .orderBy(asc(groups.groupName))
    .all();
}

/**
 * What the web's `/vacation` answers for a group: its own rows, and the rows a live mirror
 * projects into it from another group, for someone who still belongs to it.
 */
function inGroupScope(db: StoreDatabase, groupId: string) {
  const members = new Set(
    db
      .select({ userId: groupUsers.userId })
      .from(groupUsers)
      .where(and(eq(groupUsers.groupId, groupId), isNull(groupUsers.deletedAt)))
      .all()
      .map((row) => row.userId)
  );
  const mirrored = new Set(
    db
      .select({ userId: groupMirrors.userId, sourceGroupId: groupMirrors.sourceGroupId })
      .from(groupMirrors)
      .where(and(eq(groupMirrors.targetGroupId, groupId), isNull(groupMirrors.deletedAt)))
      .all()
      .filter((mirror) => members.has(mirror.userId))
      .map((mirror) => `${mirror.userId}|${mirror.sourceGroupId}`)
  );

  return (row: MergedVacation) =>
    row.groupId === groupId || mirrored.has(`${row.userId}|${row.groupId}`);
}

function namesById(
  db: StoreDatabase,
  table: typeof users | typeof groups,
  ids: readonly string[]
): Map<string, string> {
  if (ids.length === 0) return new Map();
  const name = table === users ? users.name : groups.groupName;
  const rows = db
    .select({ id: table.id, name })
    .from(table)
    .where(inArray(table.id, [...ids]))
    .all();
  return new Map(rows.map((row) => [row.id, row.name]));
}

export function scopedVacations(
  db: StoreDatabase,
  changes: readonly OverlayEntry[],
  scope: RequestListScope,
  range: DayRange
): ListedVacation[] {
  const viewerId = readSyncState(db)?.userId ?? null;
  const inScope =
    scope.kind === "mine"
      ? (row: MergedVacation) => row.userId === viewerId
      : inGroupScope(db, scope.groupId);

  const rows = mergedVacations(db, changes, range).filter(inScope);
  const people = namesById(db, users, [...new Set(rows.map((row) => row.userId))]);
  const teams = namesById(db, groups, [...new Set(rows.map((row) => row.groupId))]);

  return rows.map((row) => ({
    ...row,
    userName: people.get(row.userId) ?? null,
    groupName: teams.get(row.groupId) ?? null,
  }));
}

export function requestListVacations(
  db: StoreDatabase,
  changes: readonly OverlayEntry[],
  query: RequestListQuery
): ListedVacation[] {
  return scopedVacations(db, changes, query.scope, monthRange(query.month));
}

/** What the phone holds of a request when the server cannot be asked: the run its day sits in. */
export type StoredRequest = RequestRun & { note: string | null };

/** No run the web groups is longer than this either side of a day. */
const RUN_REACH_DAYS = 62;

export function storedRequest(
  db: StoreDatabase,
  changes: readonly OverlayEntry[],
  vacationId: string
): StoredRequest | null {
  const [row] = selectVacations(db).where(eq(vacations.id, vacationId)).all();
  if (!row) return null;

  const range = {
    from: addDays(row.requestedDay, -RUN_REACH_DAYS),
    until: addDays(row.requestedDay, RUN_REACH_DAYS + 1),
  };
  const rows = mergedVacations(db, changes, range).filter(
    (other) => other.userId === row.userId && other.groupId === row.groupId
  );
  const people = namesById(db, users, [row.userId]);
  const teams = namesById(db, groups, [row.groupId]);
  const listed = rows.map((other) => ({
    ...other,
    userName: people.get(other.userId) ?? null,
    groupName: teams.get(other.groupId) ?? null,
  }));
  const run = collapseRuns(listed).find((candidate) => candidate.vacationIds.includes(vacationId));
  const merged = rows.find((other) => other.id === vacationId);
  return run && merged ? { ...run, note: merged.note } : null;
}
