import { and, eq, inArray, isNull } from "drizzle-orm";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import type { OverlayEntry } from "./pending";
import { mergedVacations } from "./queries";
import { groupUsers, userYearQuotas, type CalendarRecordType } from "./schema";

/** One allowance of the viewer's year, the way the backend's `GET /api/users/me/balances` sums it. */
export type BalanceBucket = {
  type: CalendarRecordType;
  allocated: number;
  used: number;
  pending: number;
};

const HALF_DAY_WEIGHT = 0.5;

function liveGroupIds(db: StoreDatabase, viewerId: string): string[] {
  return db
    .select({ groupId: groupUsers.groupId })
    .from(groupUsers)
    .where(and(eq(groupUsers.userId, viewerId), isNull(groupUsers.deletedAt)))
    .all()
    .map((row) => row.groupId);
}

/**
 * The backend's counting, over what the store mirrors: the viewer's quotas for the year across
 * the groups they belong to, and their bookings in those groups. Approved days are used, days
 * neither approved nor rejected are pending, cancelled days count for nothing, and a half day
 * weighs 0.5. A booking in flight counts as pending.
 */
export function balanceBuckets(
  db: StoreDatabase,
  changes: readonly OverlayEntry[],
  year: number
): BalanceBucket[] {
  const buckets = new Map<CalendarRecordType, BalanceBucket>();
  const ensure = (type: CalendarRecordType): BalanceBucket => {
    const existing = buckets.get(type);
    if (existing) return existing;
    const created = { type, allocated: 0, used: 0, pending: 0 };
    buckets.set(type, created);
    return created;
  };

  const viewerId = readSyncState(db)?.userId;
  const groupIds = viewerId ? liveGroupIds(db, viewerId) : [];

  const quotas =
    viewerId && groupIds.length > 0
      ? db
          .select()
          .from(userYearQuotas)
          .where(
            and(
              eq(userYearQuotas.userId, viewerId),
              eq(userYearQuotas.relatedYear, String(year)),
              inArray(userYearQuotas.groupId, groupIds)
            )
          )
          .all()
      : [];
  const sum = (pick: (quota: (typeof quotas)[number]) => number) =>
    quotas.reduce((total, quota) => total + pick(quota), 0);

  ensure("VACATION").allocated = sum((quota) => quota.vacationDays + quota.carriedOverDays);
  ensure("HOME_OFFICE").allocated = sum((quota) => quota.homeOfficeDays);
  // Only once allocated: an organization without the Sick day benefit shows no empty bucket.
  const sickDays = sum((quota) => quota.sickDays);
  if (sickDays > 0) ensure("SICK_DAY").allocated = sickDays;

  if (!viewerId) return [...buckets.values()];

  const inGroups = new Set(groupIds);
  const range = { from: `${year}-01-01`, until: `${year + 1}-01-01` };
  for (const row of mergedVacations(db, changes, range)) {
    if (row.userId !== viewerId || !inGroups.has(row.groupId) || row.deletedAt != null) continue;
    const weight = row.halfDay ? HALF_DAY_WEIGHT : 1;
    if (row.approvedAt != null) ensure(row.vacationType).used += weight;
    else if (row.rejectedAt == null) ensure(row.vacationType).pending += weight;
  }

  return [...buckets.values()];
}
