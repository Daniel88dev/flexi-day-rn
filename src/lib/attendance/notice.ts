// The failure module rather than the query index: the index brings the session client, the
// toaster and the Local store, whose ESM builds break every Jest file that imports this one.
import type { Reread } from "@/lib/query";
import { ApiError, classifyFailure } from "@/lib/query/failure";

import { clockStatusOf, type ClockView } from "./clock";
import { formatClockTime } from "./format";

export type ClockAction = "clock-in" | "clock-out" | "break-start" | "break-end";

/** What Retry does: the write again, or only the re-read when the write itself landed. */
export type RetryTarget = ClockAction | "reread";

export type WriteNotice =
  | { kind: "network"; retry: RetryTarget }
  | { kind: "server"; retry: RetryTarget }
  | { kind: "refusal"; message: string | null }
  | { kind: "already-open"; message: string | null }
  | { kind: "failed"; message: string | null };

const CONFLICT = 409;

function retryableNotice(failure: unknown, retry: RetryTarget): WriteNotice {
  return failure instanceof ApiError ? { kind: "server", retry } : { kind: "network", retry };
}

/**
 * How a failed clock write reads in the sheet. A clock-in's only 409 is `SESSION_ALREADY_OPEN`,
 * a session opened somewhere else, so it gets a notice of its own rather than the server's words.
 */
export function noticeForFailure(action: ClockAction, failure: unknown): WriteNotice | null {
  const failureClass = classifyFailure(failure);
  switch (failureClass.kind) {
    case "retryable":
      return retryableNotice(failure, action);
    case "refusal":
      if (action === "clock-in" && failure instanceof ApiError && failure.status === CONFLICT) {
        return { kind: "already-open", message: failureClass.message };
      }
      return { kind: "refusal", message: failureClass.message };
    case "failed":
      return { kind: "failed", message: failureClass.message };
    case "signed-out":
      return null;
  }
}

/**
 * The notice once the re-read after a write has settled. When that read failed, a notice that
 * needs it, or a write that landed with nothing to say, gives way to the read's own failure, so
 * the person is never left with a haptic and nothing on screen.
 */
export function settleNotice(notice: WriteNotice | null, reread: Reread): WriteNotice | null {
  if (reread.arrived) return notice;
  if (notice === null || notice.kind === "already-open") {
    return retryableNotice(reread.error, "reread");
  }
  return notice;
}

export type ShownNotice =
  Exclude<WriteNotice, { kind: "already-open" }> | { kind: "already-open"; since: string };

/**
 * The notice as the sheet shows it against the last read. A refusal the lock notice explains and
 * a network failure the offline notice explains are dropped; "already open" takes its time from
 * the session the re-read found, and falls back to the server's words when there is none.
 */
export function shownNotice(
  notice: WriteNotice,
  view: Extract<ClockView, { kind: "ready" }>
): ShownNotice | null {
  const { state } = view;
  if (notice.kind === "network" && view.offline) return null;
  if (notice.kind === "refusal" && clockStatusOf(state) === "inactive") return null;
  if (notice.kind !== "already-open") return notice;
  if (!state.openSession) return { kind: "refusal", message: notice.message };
  return {
    kind: "already-open",
    since: formatClockTime(state.openSession.startedAt, state.timezone),
  };
}

export const hapticForNotice = (notice: WriteNotice): "warning" | "error" =>
  notice.kind === "network" || notice.kind === "server" ? "error" : "warning";
