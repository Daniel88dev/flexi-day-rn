import { and, asc, eq, isNull } from "drizzle-orm";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import { groups, groupUsers, organizations } from "./schema";

export type GroupRole = "manager" | "admin" | "approver";

export type MyGroup = {
  id: string;
  name: string;
  /** Null while the store lacks the organization's row. */
  organizationName: string | null;
  defaultVacationDays: number;
  defaultHomeOfficeDays: number;
  defaultSickDays: number;
  /** `Date.getDay()` numbers, Sunday 0. */
  workingDays: number[];
  holidayCountry: string | null;
  role: GroupRole | null;
};

/**
 * The viewer's live memberships in live groups, by group name. The role only picks the card's
 * badge (ADR 0003): like the web's, it leaves org-admin standing out.
 */
export function myGroupsWithRole(db: StoreDatabase): MyGroup[] {
  const viewerId = readSyncState(db)?.userId;
  if (!viewerId) return [];

  const rows = db
    .select({
      id: groups.id,
      name: groups.groupName,
      organizationName: organizations.name,
      defaultVacationDays: groups.defaultVacationDays,
      defaultHomeOfficeDays: groups.defaultHomeOfficeDays,
      defaultSickDays: groups.defaultSickDays,
      workingDays: groups.workingDays,
      holidayCountry: groups.holidayCountry,
      managerUserId: groups.managerUserId,
      adminAccess: groupUsers.adminAccess,
      approverAccess: groupUsers.approverAccess,
    })
    .from(groupUsers)
    .innerJoin(groups, eq(groupUsers.groupId, groups.id))
    .leftJoin(organizations, eq(organizations.id, groups.organizationId))
    .where(
      and(eq(groupUsers.userId, viewerId), isNull(groupUsers.deletedAt), isNull(groups.deletedAt))
    )
    .orderBy(asc(groups.groupName))
    .all();

  return rows.map(({ managerUserId, adminAccess, approverAccess, ...group }) => ({
    ...group,
    role:
      managerUserId === viewerId
        ? "manager"
        : adminAccess
          ? "admin"
          : approverAccess
            ? "approver"
            : null,
  }));
}
