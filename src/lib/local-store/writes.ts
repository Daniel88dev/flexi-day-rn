import { storeCreatedVacations } from "./apply";
import type { StoreClock } from "./clock";
import { serverMessage, type StoreFetch } from "./fetch";
import type { PendingChanges, VacationDraft } from "./pending";
import type { PullOutcome, PullReason } from "./pull";
import type { StoreRuntime } from "./runtime";

export const WRITE_TIMEOUT_MS = 10_000;

export const CREATE_VACATION_PATH = "/api/vacation/create-vacation";

/**
 * What a caller learns about the write it asked for. A 401 answers `ok` because the signed-out
 * wipe is the feedback and there is nothing to say. A failure says which kind it was: the caller
 * reaches for its own copy on `unreachable`, and shows the server's words on `rejected`.
 */
export type WriteOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: "unreachable" | "rejected";
      /** What the server said about refusing, when it said anything at all. */
      message: string | null;
    };

const WRITTEN: WriteOutcome = { ok: true };

/** The write reached no answer at all: the timeout fired, or the connection or the body broke. */
type WriteUnreachable = { type: "unreachable" };

type WriteRefused = { type: "rejected"; message: string | null };

type WriteResponse =
  { type: "written"; body: unknown } | { type: "unauthorized" } | WriteUnreachable | WriteRefused;

export type StoreWrites = {
  createVacation(draft: VacationDraft): Promise<WriteOutcome>;
};

export type StoreWriteOptions = {
  runtime: StoreRuntime;
  apiFetch: StoreFetch;
  clock: StoreClock;
  pending: PendingChanges;
  pull: (reason: PullReason) => Promise<PullOutcome>;
  onUnauthorized: () => void;
};

async function postJson(
  apiFetch: StoreFetch,
  clock: StoreClock,
  path: string,
  body: unknown
): Promise<WriteResponse> {
  const request = new AbortController();
  const cancelTimeout = clock.setTimeout(() => request.abort(), WRITE_TIMEOUT_MS);
  try {
    const response = await apiFetch(path, {
      signal: request.signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return { type: "unauthorized" };
    if (response.status < 200 || response.status >= 300) {
      return { type: "rejected", message: await serverMessage(response) };
    }
    return { type: "written", body: await response.json() };
  } catch {
    return { type: "unreachable" };
  } finally {
    cancelTimeout();
  }
}

function failureOf(response: WriteUnreachable | WriteRefused): WriteOutcome {
  return response.type === "unreachable"
    ? { ok: false, reason: "unreachable", message: null }
    : { ok: false, reason: "rejected", message: response.message };
}

export function createStoreWrites({
  runtime,
  apiFetch,
  clock,
  pending,
  pull,
  onUnauthorized,
}: StoreWriteOptions): StoreWrites {
  return {
    async createVacation(draft) {
      const change = pending.add({ kind: "create", draft });
      const response = await postJson(apiFetch, clock, CREATE_VACATION_PATH, draft);

      if (response.type === "unauthorized") {
        pending.remove(change.id);
        onUnauthorized();
        // The signed-out wipe is the feedback; there is nothing for the caller to say.
        return { ok: true };
      }

      if (response.type !== "written") {
        pending.remove(change.id);
        return failureOf(response);
      }

      // The rows land and the change lifts with no await between them, so the bus carries both
      // in one flush and no read falls in the gap and finds the list empty.
      storeCreatedVacations(runtime, response.body);
      pending.remove(change.id);
      // What the server booked around these rows — a quota, a notification's twin — comes next.
      void pull("after-write");
      return WRITTEN;
    },
  };
}
