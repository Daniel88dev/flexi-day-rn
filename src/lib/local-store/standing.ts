import { and, eq, isNull, or } from "drizzle-orm";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import { groups, groupUsers } from "./schema";

export type GroupStanding = {
  /** The viewer belongs to at least one live group. */
  member: boolean;
  /** Manager, main or temp approver, or approver access, in at least one live group. */
  approver: boolean;
};

/**
 * What the dashboard shows the viewer, never what the viewer may do (ADR 0003): the approver half
 * only decides whether the Pending tile and the Approvals card appear. It is exact because org
 * admins never approve, so no standing the phone lacks can make someone an approver.
 */
export function groupStanding(db: StoreDatabase): GroupStanding {
  const viewerId = readSyncState(db)?.userId;
  if (!viewerId) return { member: false, approver: false };

  const [membership] = db
    .select({ id: groupUsers.id })
    .from(groupUsers)
    .innerJoin(groups, eq(groupUsers.groupId, groups.id))
    .where(
      and(eq(groupUsers.userId, viewerId), isNull(groupUsers.deletedAt), isNull(groups.deletedAt))
    )
    .limit(1)
    .all();

  const [approving] = db
    .select({ id: groups.id })
    .from(groups)
    .leftJoin(
      groupUsers,
      and(
        eq(groupUsers.groupId, groups.id),
        eq(groupUsers.userId, viewerId),
        isNull(groupUsers.deletedAt)
      )
    )
    .where(
      and(
        isNull(groups.deletedAt),
        or(
          eq(groups.managerUserId, viewerId),
          eq(groups.mainApprovalUser, viewerId),
          eq(groups.tempApprovalUser, viewerId),
          eq(groupUsers.approverAccess, true)
        )
      )
    )
    .limit(1)
    .all();

  return { member: membership !== undefined, approver: approving !== undefined };
}
