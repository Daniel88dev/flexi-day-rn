import type { Dictionary } from "@/i18n";
// The failure module rather than the query index, which Jest cannot load from here.
import { ApiError } from "@/lib/query/failure";

/** The backend's `DeletionBlocker` (`flexi-day-be/src/services/accountDeletion/types.ts`). */
export type DeletionBlocker =
  | { kind: "GROUP_HAS_MEMBERS"; groupId: string; groupName: string; otherMembers: number }
  | {
      kind: "ORGANIZATION_HAS_MEMBERS";
      organizationId: string;
      organizationName: string;
      otherMembers: number;
    }
  | { kind: "SUBSCRIPTION_RENEWING"; organizationId: string; organizationName: string }
  | { kind: "SUPPORT_ADMIN" };

export type DeletionConfirmation = "password" | "recent-sign-in";

export type DeletionStatus = {
  canDelete: boolean;
  blockers: DeletionBlocker[];
  confirmation: DeletionConfirmation;
};

export const DELETION_STATUS_PATH = "/api/users/me/deletion";
export const DELETE_ACCOUNT_PATH = "/api/users/me/delete";

const BLOCKER_KINDS: ReadonlySet<string> = new Set([
  "GROUP_HAS_MEMBERS",
  "ORGANIZATION_HAS_MEMBERS",
  "SUBSCRIPTION_RENEWING",
  "SUPPORT_ADMIN",
]);

function isBlocker(value: unknown): value is DeletionBlocker {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof value.kind === "string" &&
    BLOCKER_KINDS.has(value.kind)
  );
}

export type DeletionFailure =
  | { kind: "wrong-password" }
  | { kind: "reauth" }
  | { kind: "blocked"; blockers: DeletionBlocker[] }
  | { kind: "unanswered" }
  | { kind: "server" }
  | { kind: "refused"; message: string | null };

const UNAUTHORIZED = 401;

/** How a refused delete reads in its sheet; null for a 401, which the wipe has. */
export function deletionFailureOf(failure: unknown): DeletionFailure | null {
  if (!(failure instanceof ApiError)) return { kind: "unanswered" };
  if (failure.status === UNAUTHORIZED) return null;
  if (failure.status >= 500) return { kind: "server" };

  const { reason, blockers } = failure.context ?? {};
  if (reason === "PASSWORD_INVALID") return { kind: "wrong-password" };
  if (reason === "REAUTH_REQUIRED") return { kind: "reauth" };
  if (reason === "DELETION_BLOCKED") {
    return { kind: "blocked", blockers: Array.isArray(blockers) ? blockers.filter(isBlocker) : [] };
  }
  return { kind: "refused", message: failure.serverMessage };
}

/** What the sheet shows while the check is read again after a refusal that changed it. */
export function statusAfterRefusal(
  status: DeletionStatus | undefined,
  failure: DeletionFailure
): DeletionStatus | undefined {
  // A 409 that names nothing leaves the last answer up until the check is read again.
  if (failure.kind === "blocked" && failure.blockers.length > 0) {
    return {
      canDelete: false,
      blockers: failure.blockers,
      confirmation: status?.confirmation ?? "password",
    };
  }
  if (failure.kind === "reauth" && status) return { ...status, confirmation: "recent-sign-in" };
  return status;
}

export type DeletionView =
  | { kind: "loading" }
  | { kind: "unreachable" }
  | { kind: "blocked"; blockers: DeletionBlocker[] }
  | { kind: "password" }
  | { kind: "web" };

export function deletionView(
  status: DeletionStatus | undefined,
  readFailed: boolean
): DeletionView {
  if (!status) return readFailed ? { kind: "unreachable" } : { kind: "loading" };
  if (!status.canDelete) return { kind: "blocked", blockers: status.blockers };
  return status.confirmation === "password" ? { kind: "password" } : { kind: "web" };
}

export function blockerText(blocker: DeletionBlocker, t: Dictionary): string {
  const copy = t.settings.deleteAccount.blockers;
  switch (blocker.kind) {
    case "GROUP_HAS_MEMBERS":
      return copy.groupHasMembers(blocker.groupName, blocker.otherMembers);
    case "ORGANIZATION_HAS_MEMBERS":
      return copy.organizationHasMembers(blocker.organizationName, blocker.otherMembers);
    case "SUBSCRIPTION_RENEWING":
      return copy.subscriptionRenewing(blocker.organizationName);
    case "SUPPORT_ADMIN":
      return copy.supportAdmin;
  }
}

/** What tells two blockers apart in a list: the kind, and the group or organization it names. */
export function blockerKey(blocker: DeletionBlocker): string {
  switch (blocker.kind) {
    case "GROUP_HAS_MEMBERS":
      return `${blocker.kind}-${blocker.groupId}`;
    case "ORGANIZATION_HAS_MEMBERS":
    case "SUBSCRIPTION_RENEWING":
      return `${blocker.kind}-${blocker.organizationId}`;
    case "SUPPORT_ADMIN":
      return blocker.kind;
  }
}
