import { and, eq, inArray, isNull } from "drizzle-orm";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import type { OverlayEntry } from "./pending";
import { mergedVacations } from "./queries";
import {
  groups,
  groupUsers,
  organizations,
  userYearQuotas,
  type CalendarRecordType,
} from "./schema";

/** One allowance of the viewer's year, the way the backend's `GET /api/users/me/balances` sums it. */
export type BalanceBucket = {
  type: CalendarRecordType;
  allocated: number;
  used: number;
  pending: number;
};

type QuotaFigures = {
  vacationDays: number;
  homeOfficeDays: number;
  sickDays: number;
  carriedOverDays: number;
};

/** Unknown while the sync pull leaves the organization's toggle out. */
type SickDayBenefit = "on" | "off" | "unknown";

type GroupPolicy = {
  defaultVacationDays: number;
  defaultHomeOfficeDays: number;
  defaultSickDays: number;
  sickDayBenefit: SickDayBenefit;
};

type YearAllocation = QuotaFigures & { sickDayMetered: boolean };

const HALF_DAY_WEIGHT = 0.5;

function liveGroupIds(db: StoreDatabase, viewerId: string): string[] {
  return db
    .select({ groupId: groupUsers.groupId })
    .from(groupUsers)
    .where(and(eq(groupUsers.userId, viewerId), isNull(groupUsers.deletedAt)))
    .all()
    .map((row) => row.groupId);
}

function yearQuotas(
  db: StoreDatabase,
  viewerId: string,
  groupIds: string[],
  year: number
): Map<string, QuotaFigures> {
  if (groupIds.length === 0) return new Map();
  const rows = db
    .select()
    .from(userYearQuotas)
    .where(
      and(
        eq(userYearQuotas.userId, viewerId),
        eq(userYearQuotas.relatedYear, String(year)),
        inArray(userYearQuotas.groupId, groupIds)
      )
    )
    .all();
  return new Map(rows.map((row) => [row.groupId, row]));
}

function sickDayBenefit(enabled: boolean | null): SickDayBenefit {
  if (enabled == null) return "unknown";
  return enabled ? "on" : "off";
}

function groupPolicies(db: StoreDatabase, groupIds: string[]): Map<string, GroupPolicy> {
  if (groupIds.length === 0) return new Map();
  const rows = db
    .select({
      id: groups.id,
      defaultVacationDays: groups.defaultVacationDays,
      defaultHomeOfficeDays: groups.defaultHomeOfficeDays,
      defaultSickDays: groups.defaultSickDays,
      sickDayBenefitEnabled: organizations.sickDayBenefitEnabled,
    })
    .from(groups)
    .leftJoin(organizations, eq(groups.organizationId, organizations.id))
    .where(and(inArray(groups.id, groupIds), isNull(groups.deletedAt)))
    .all();
  return new Map(
    rows.map(({ id, sickDayBenefitEnabled, ...defaults }) => [
      id,
      { ...defaults, sickDayBenefit: sickDayBenefit(sickDayBenefitEnabled) },
    ])
  );
}

/**
 * The backend's `resolveYearAllocation` and the Sick day gate of its `allowanceFor`: a missing
 * quota row means the group defaults with nothing carried over, and a group meters sick days only
 * while its organization has the benefit on.
 */
function yearAllocation(
  quota: QuotaFigures | undefined,
  policy: GroupPolicy | undefined
): YearAllocation {
  const figures = quota ?? {
    vacationDays: policy?.defaultVacationDays ?? 0,
    homeOfficeDays: policy?.defaultHomeOfficeDays ?? 0,
    sickDays: policy?.defaultSickDays ?? 0,
    carriedOverDays: 0,
  };
  switch (policy?.sickDayBenefit) {
    case "on":
      return { ...figures, sickDayMetered: true };
    case "unknown":
      return { ...figures, sickDays: quota?.sickDays ?? 0, sickDayMetered: false };
    case "off":
    case undefined:
      return { ...figures, sickDays: 0, sickDayMetered: false };
  }
}

/**
 * A Sick day bucket shows once any group meters sick days, even with none allocated, the way
 * `GET /api/users/me/balances` does; while the pull has not sent the toggle, it shows only once
 * quota rows allocate some.
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

  const vacation = ensure("VACATION");
  const homeOffice = ensure("HOME_OFFICE");

  const viewerId = readSyncState(db)?.userId;
  if (!viewerId) return [...buckets.values()];

  const groupIds = liveGroupIds(db, viewerId);
  const quotas = yearQuotas(db, viewerId, groupIds, year);
  const policies = groupPolicies(db, groupIds);
  let sickDays = 0;
  let sickDayMetered = false;
  for (const groupId of groupIds) {
    const allocation = yearAllocation(quotas.get(groupId), policies.get(groupId));
    vacation.allocated += allocation.vacationDays + allocation.carriedOverDays;
    homeOffice.allocated += allocation.homeOfficeDays;
    sickDays += allocation.sickDays;
    sickDayMetered ||= allocation.sickDayMetered;
  }
  if (sickDayMetered || sickDays > 0) ensure("SICK_DAY").allocated = sickDays;

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
