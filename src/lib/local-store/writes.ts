import { serverFailure } from "@/lib/api";

import { storeProvisionalVacations, storeWrittenVacations } from "./apply";
import type { StoreClock } from "./clock";
import type { StoreFetch, StoreRequestMethod } from "./fetch";
import type {
  PendingChange,
  PendingChanges,
  PendingKind,
  VacationDraft,
  VacationUpdateDraft,
} from "./pending";
import type { PullOutcome, PullReason } from "./pull";
import type { StoreRuntime } from "./runtime";

export const WRITE_TIMEOUT_MS = 10_000;

export const VACATION_PATH = "/api/vacation";
export const CREATE_VACATION_PATH = `${VACATION_PATH}/create-vacation`;
export const APPROVE_VACATION_PATH = `${VACATION_PATH}/approve`;
export const REJECT_VACATION_PATH = `${VACATION_PATH}/reject`;
export const CANCEL_VACATION_PATH = `${VACATION_PATH}/cancel`;

/**
 * What a caller learns about the write it asked for. A 401 answers `ok` because the signed-out
 * wipe is the feedback and there is nothing to say. A failure says which kind it was: the caller
 * reaches for its own copy on `unreachable`, and shows the server's words on `rejected`, reading
 * `context` where the server said more than words, such as a 409's `conflictingDays`.
 */
export type WriteFailure =
  | {
      ok: false;
      reason: "unreachable";
      message: null;
    }
  | {
      ok: false;
      reason: "rejected";
      status: number;
      /** What the server said about refusing, when it said anything at all. */
      message: string | null;
      context?: Record<string, unknown>;
    };

export type WriteOutcome = { ok: true } | WriteFailure;

/** The booking the server made: every day shares `requestId`, and files hang off it. */
export type CreatedRequest = { requestId: string; vacationId: string };

/** `created` is missing only when the answer carried no rows, a 401 among them. */
export type CreateOutcome = { ok: true; created?: CreatedRequest } | WriteFailure;

const WRITTEN: WriteOutcome = { ok: true };

/** The write reached no answer at all: the timeout fired, or the connection or the body broke. */
type WriteUnreachable = { type: "unreachable" };

type WriteRefused = {
  type: "rejected";
  status: number;
  message: string | null;
  context?: Record<string, unknown>;
};

type WriteResponse =
  { type: "written"; body: unknown } | { type: "unauthorized" } | WriteUnreachable | WriteRefused;

/** What an edit is asked for: the rows it names, and the fields to write across all of them. */
export type VacationUpdate = VacationUpdateDraft & { ids: string[] };

/** The three decisions the backend confirms with a message and no rows at all. */
type DecisionKind = Extract<PendingKind, "approve" | "reject" | "cancel">;

export type StoreWrites = {
  createVacation(draft: VacationDraft): Promise<CreateOutcome>;
  updateVacation(input: VacationUpdate): Promise<WriteOutcome>;
  approveVacations(ids: string[]): Promise<WriteOutcome>;
  rejectVacations(ids: string[], reason?: string): Promise<WriteOutcome>;
  cancelVacations(ids: string[], reason?: string): Promise<WriteOutcome>;
};

export type StoreWriteOptions = {
  runtime: StoreRuntime;
  apiFetch: StoreFetch;
  clock: StoreClock;
  pending: PendingChanges;
  pull: (reason: PullReason) => Promise<PullOutcome>;
};

type JsonRequest = { method: StoreRequestMethod; path: string; body: unknown };

/** One id goes to the endpoint of that row, several to the bulk one that takes them as a list. */
function decisionRequest(kind: DecisionKind, ids: string[], reason?: string): JsonRequest {
  const only = ids.length === 1 ? ids[0] : null;
  if (kind === "cancel") {
    return only
      ? { method: "DELETE", path: `${VACATION_PATH}/${only}`, body: { reason } }
      : { method: "POST", path: CANCEL_VACATION_PATH, body: { ids, reason } };
  }

  const path = kind === "approve" ? APPROVE_VACATION_PATH : REJECT_VACATION_PATH;
  return only
    ? { method: "POST", path: `${path}/${only}`, body: { reason } }
    : { method: "POST", path, body: { ids, reason } };
}

async function sendJson(
  apiFetch: StoreFetch,
  clock: StoreClock,
  { method, path, body }: JsonRequest
): Promise<WriteResponse> {
  const request = new AbortController();
  const cancelTimeout = clock.setTimeout(() => request.abort(), WRITE_TIMEOUT_MS);
  try {
    const response = await apiFetch(path, {
      signal: request.signal,
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return { type: "unauthorized" };
    if (response.status < 200 || response.status >= 300) {
      return { type: "rejected", status: response.status, ...(await serverFailure(response)) };
    }
    return { type: "written", body: await response.json() };
  } catch {
    return { type: "unreachable" };
  } finally {
    cancelTimeout();
  }
}

function failureOf(response: WriteUnreachable | WriteRefused): WriteFailure {
  if (response.type === "unreachable") return { ok: false, reason: "unreachable", message: null };
  const { status, message, context } = response;
  return { ok: false, reason: "rejected", status, message, context };
}

function createdRequestOf(body: unknown): CreatedRequest | null {
  const [first] = Array.isArray(body) ? (body as { id?: unknown; requestId?: unknown }[]) : [];
  return typeof first?.id === "string" && typeof first.requestId === "string"
    ? { requestId: first.requestId, vacationId: first.id }
    : null;
}

export function createStoreWrites({
  runtime,
  apiFetch,
  clock,
  pending,
  pull,
}: StoreWriteOptions): StoreWrites {
  /**
   * Every write ends the same way; only what an answer leaves in the store differs. A commit may
   * hand back what to undo once the pull after the write settles.
   */
  const settle = (
    change: PendingChange,
    response: WriteResponse,
    commit: (body: unknown) => (() => void) | void
  ): WriteOutcome => {
    if (response.type === "unauthorized") {
      pending.remove(change.id);
      // The request wrapper handed the 401 over; there is nothing for the caller to say.
      return WRITTEN;
    }

    if (response.type !== "written") {
      pending.remove(change.id);
      return failureOf(response);
    }

    // The rows land and the change lifts with no await between them, so the bus carries both
    // in one flush and no read falls in the gap and finds the list empty.
    const afterPull = commit(response.body);
    pending.remove(change.id);
    // What the server booked around these rows — a quota, a notification's twin — comes next.
    const pulled = pull("after-write");
    if (afterPull) void pulled.catch(() => undefined).then(afterPull);
    return WRITTEN;
  };

  const decide = async (kind: DecisionKind, ids: string[], reason?: string) => {
    if (ids.length === 0) return WRITTEN;

    const change = pending.add({ kind, vacationIds: ids, reason });
    const response = await sendJson(apiFetch, clock, decisionRequest(kind, ids, reason));
    // The answer carries no rows, so the store writes what the change expected and the pull that
    // follows overwrites it with the server's own row.
    return settle(change, response, () => {
      storeProvisionalVacations(runtime, change);
      const mark = pending.markProvisional(ids);
      return () => pending.remove(mark.id);
    });
  };

  return {
    async createVacation(draft) {
      const change = pending.add({ kind: "create", draft });
      const response = await sendJson(apiFetch, clock, {
        method: "POST",
        path: CREATE_VACATION_PATH,
        body: draft,
      });
      const outcome = settle(change, response, (body) => storeWrittenVacations(runtime, body));
      const created = response.type === "written" ? createdRequestOf(response.body) : null;
      return outcome.ok && created ? { ok: true, created } : outcome;
    },

    async updateVacation({ ids, ...update }) {
      // Nothing to edit is nothing to send; the backend refuses an empty list anyway.
      if (ids.length === 0) return WRITTEN;

      const change = pending.add({ kind: "update", vacationIds: ids, update });
      const response = await sendJson(apiFetch, clock, {
        method: "PATCH",
        path: VACATION_PATH,
        body: { ids, ...update },
      });
      return settle(change, response, (body) => storeWrittenVacations(runtime, body));
    },

    approveVacations: (ids) => decide("approve", ids),

    rejectVacations: (ids, reason) => decide("reject", ids, reason),

    cancelVacations: (ids, reason) => decide("cancel", ids, reason),
  };
}
