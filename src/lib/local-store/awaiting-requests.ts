import { and, eq, isNull } from "drizzle-orm";

import { collapseRuns, type RequestRun } from "@/lib/requests/runs";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import type { OverlayEntry } from "./pending";
import { scopedVacations } from "./requests";
import { groupMirrors, groups, groupUsers } from "./schema";

/**
 * Groups where the viewer decides their own requests, the backend's `mayDecideOwn`: approver
 * access on a live membership, and no live mirror of their records into the group.
 */
function selfDecidableGroups(db: StoreDatabase, viewerId: string): Set<string> {
  const mirroredInto = new Set(
    db
      .select({ groupId: groupMirrors.targetGroupId })
      .from(groupMirrors)
      .where(and(eq(groupMirrors.userId, viewerId), isNull(groupMirrors.deletedAt)))
      .all()
      .map((row) => row.groupId)
  );
  return new Set(
    db
      .select({ groupId: groupUsers.groupId })
      .from(groupUsers)
      .where(
        and(
          eq(groupUsers.userId, viewerId),
          eq(groupUsers.approverAccess, true),
          isNull(groupUsers.deletedAt)
        )
      )
      .all()
      .map((row) => row.groupId)
      .filter((groupId) => !mirroredInto.has(groupId))
  );
}

/**
 * The viewer's own requests still awaiting approval in live groups, as date ranges, mirroring the
 * backend's `/me/pending-requests`. Those the viewer may decide are left out: `/me/approvals` lists
 * them.
 */
export function myAwaitingRequests(
  db: StoreDatabase,
  changes: readonly OverlayEntry[]
): RequestRun[] {
  const viewerId = readSyncState(db)?.userId;
  if (!viewerId) return [];

  const liveGroups = new Set(
    db
      .select({ id: groups.id })
      .from(groups)
      .where(isNull(groups.deletedAt))
      .all()
      .map((row) => row.id)
  );
  const decidable = selfDecidableGroups(db, viewerId);

  return collapseRuns(
    scopedVacations(db, changes, { kind: "mine" }).filter(
      (row) =>
        row.status === "pending" && liveGroups.has(row.groupId) && !decidable.has(row.groupId)
    )
  );
}
