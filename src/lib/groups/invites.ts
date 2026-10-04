import type { Dictionary } from "@/i18n";
// The failure module rather than the query index, which imports this one.
import { ApiError } from "@/lib/query/failure";

export type InviteInput =
  { kind: "link"; token: string } | { kind: "broken-link" } | { kind: "code"; code: string };

/** What reaches the server: a broken link never does. */
export type JoinInput = Exclude<InviteInput, { kind: "broken-link" }>;

const JOIN_PATH = /\/join\/?$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** The path as `new URL(value, base)` would read it; Hermes' URL has no `pathname`. */
function pathOf(beforeQuery: string): string {
  let rest = beforeQuery;
  const scheme = SCHEME.exec(rest);
  if (scheme) rest = rest.slice(scheme[0].length);
  if (rest.startsWith("//")) {
    const slash = rest.indexOf("/", 2);
    return slash === -1 ? "" : rest.slice(slash);
  }
  return rest;
}

function tokenOf(query: string): string | null {
  for (const pair of query.split("&")) {
    const [key, value = ""] = pair.split("=");
    if (key !== "token") continue;
    try {
      return decodeURIComponent(value.replace(/\+/g, " ")).trim() || null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Tells a pasted invite link from a bare invite code, as the web does. Null for blank input. */
export function parseInviteInput(raw: string): InviteInput | null {
  const value = raw.trim();
  if (!value) return null;
  if (!value.includes("/")) return { kind: "code", code: value };

  const [withoutFragment] = value.split("#");
  const queryStart = withoutFragment.indexOf("?");
  const beforeQuery = queryStart === -1 ? withoutFragment : withoutFragment.slice(0, queryStart);
  if (!JOIN_PATH.test(pathOf(beforeQuery))) return { kind: "code", code: value };

  const token = queryStart === -1 ? null : tokenOf(withoutFragment.slice(queryStart + 1));
  return token ? { kind: "link", token } : { kind: "broken-link" };
}

export type JoinRefusal =
  | { kind: "inline"; message: string }
  | { kind: "already-member"; groupId: string }
  | { kind: "unmapped" };

const contextString = (failure: ApiError, key: string) => {
  const value = failure.context?.[key];
  return typeof value === "string" ? value : null;
};

/** The group a 409 `ALREADY_MEMBER` names, the one refusal that opens a group. */
export function alreadyMemberGroup(failure: unknown): string | null {
  if (!(failure instanceof ApiError) || failure.status !== 409) return null;
  if (contextString(failure, "code") !== "ALREADY_MEMBER") return null;
  return contextString(failure, "groupId");
}

export type ClosedInvite = "used" | "expired" | "revoked";

const CLOSED_CODES = new Map<string | null, ClosedInvite>([
  ["INVITE_USED", "used"],
  ["INVITE_EXPIRED", "expired"],
  ["INVITE_REVOKED", "revoked"],
]);

/** The state a 410 names: the invite exists but can no longer be redeemed. */
export function closedInvite(failure: unknown): ClosedInvite | null {
  if (!(failure instanceof ApiError) || failure.status !== 410) return null;
  return CLOSED_CODES.get(contextString(failure, "code")) ?? null;
}

/**
 * The line a refused join shows under the field. Anything unmapped belongs to the shared
 * write-failure handler.
 */
export function joinRefusal(failure: unknown, via: JoinInput["kind"], t: Dictionary): JoinRefusal {
  if (!(failure instanceof ApiError)) return { kind: "unmapped" };
  const groupId = alreadyMemberGroup(failure);
  if (groupId) return { kind: "already-member", groupId };

  const errors = t.join.errors;
  const inline = (message: string): JoinRefusal => ({ kind: "inline", message });
  const onCode = via === "code";

  switch (contextString(failure, "code")) {
    case "INVITE_NOT_FOUND":
      return inline(errors.notFound);
    case "INVITE_USED":
      return inline(errors.used);
    case "INVITE_EXPIRED":
      return inline(errors.expired);
    case "INVITE_REVOKED":
      return inline(errors.revoked);
    case "INVITE_EMAIL_MISMATCH":
      return inline(errors.emailMismatch);
    case "EMAIL_NOT_VERIFIED_USE_INVITE_LINK":
      return inline(errors.unverified);
    case null:
      break;
    default:
      return { kind: "unmapped" };
  }

  const reason = contextString(failure, "reason");
  if (failure.status === 402 && reason === "READ_ONLY") return inline(t.newRequest.readOnlyGroup);
  if (failure.status === 402 && reason === "PLAN_LIMIT") {
    const limit = failure.context?.limit;
    return inline(t.newRequest.memberLimitReached(typeof limit === "number" ? limit : 0));
  }
  if (onCode && failure.status === 404) return inline(errors.notFound);
  if (onCode && failure.status === 403) return inline(errors.emailMismatch);
  if (onCode && failure.status === 400) return inline(errors.malformedCode);
  // The token failed the server's length check, so the link was cut short on its way here.
  if (!onCode && failure.status === 422) return inline(errors.brokenLink);
  return { kind: "unmapped" };
}

/** A preview the server has no invite for: unknown, or a token too short to look one up. */
export function inviteMissing(failure: unknown): boolean {
  return failure instanceof ApiError && (failure.status === 404 || failure.status === 422);
}

export type JoinScreenAction = "already-member" | "join" | "wrong-account";

/**
 * Which action an invite offers the signed-in viewer; a member is told so even on a closed one. The membership is a display-only
 * local check (ADR 0003): a stale row costs one sync pull, and the backend still answers
 * `ALREADY_MEMBER`.
 */
export function joinScreenAction(
  invite: { groupId: string; invitedEmail: string | null },
  memberGroupIds: readonly string[],
  viewerEmail: string | null
): JoinScreenAction {
  if (memberGroupIds.includes(invite.groupId)) return "already-member";
  if (invite.invitedEmail === null || viewerEmail === null) return "join";
  return invite.invitedEmail.toLowerCase() === viewerEmail.toLowerCase() ? "join" : "wrong-account";
}

/** `dana@northwind.co` → `d…@northwind.co`, as the web shows it: enough to pick the right account. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "…";
  return `${email[0]}…${email.slice(at)}`;
}
