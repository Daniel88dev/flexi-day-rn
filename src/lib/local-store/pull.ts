import { applyPage, readSyncState, sweepGenerations, writeSyncState } from "./apply";
import type { StoreClock } from "./clock";
import type { SyncEnvelope } from "./envelope";
import type { StoreRuntime } from "./runtime";

export type PullReason = "foreground" | "refresh" | "after-write";

export const SYNC_PULL_PATH = "/api/sync/pull";

export const PAGE_TIMEOUT_MS = 30_000;

/** As much of a response as the loop reads, so the device passes `fetch` and Jest passes a fake. */
export type SyncPageResponse = {
  status: number;
  json(): Promise<unknown>;
};

/** A fetch already bound to the API base URL: the loop only ever names a path. */
export type SyncFetch = (path: string, init: { signal: AbortSignal }) => Promise<SyncPageResponse>;

export type PullStatus = {
  inFlight: boolean;
  lastError: string | null;
};

export type PullController = {
  pull(reason: PullReason): Promise<void>;
  status(): PullStatus;
};

export type PullControllerOptions = {
  runtime: StoreRuntime;
  fetchPage: SyncFetch;
  clock: StoreClock;
  isOnline: () => Promise<boolean>;
  onUnauthorized: () => void;
};

class UnauthorizedError extends Error {}

function pullPath(cursor: string | null): string {
  return cursor ? `${SYNC_PULL_PATH}?cursor=${encodeURIComponent(cursor)}` : SYNC_PULL_PATH;
}

/** The membership tombstones the server answers with a snapshot rather than a delta. */
function carriesMembershipTombstone(page: SyncEnvelope): boolean {
  const tombstoned = (row: { deletedAt?: string | null }) => row.deletedAt != null;
  return page.groupUsers.some(tombstoned) || page.groupMirrors.some(tombstoned);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createPullController({
  runtime,
  fetchPage,
  clock,
  isOnline,
  onUnauthorized,
}: PullControllerOptions): PullController {
  let status: PullStatus = { inFlight: false, lastError: null };
  let running: Promise<void> | null = null;
  let pending = false;

  const setStatus = (patch: Partial<PullStatus>) => {
    const next = { ...status, ...patch };
    if (next.inFlight === status.inFlight && next.lastError === status.lastError) return;
    status = next;
    // The status rides the store's own bus, so `useSyncStatus` re-reads with every other hook.
    runtime.events.emit(["syncState"]);
  };

  const requestPage = async (cursor: string | null): Promise<SyncEnvelope> => {
    const request = new AbortController();
    const cancelTimeout = clock.setTimeout(() => request.abort(), PAGE_TIMEOUT_MS);
    try {
      const response = await fetchPage(pullPath(cursor), { signal: request.signal });
      if (response.status === 401) throw new UnauthorizedError("The sync pull was not authorized.");
      if (response.status !== 200) {
        throw new Error(`The sync pull answered ${response.status}.`);
      }
      return (await response.json()) as SyncEnvelope;
    } catch (error) {
      if (request.signal.aborted) throw new Error("The sync pull timed out.");
      throw error;
    } finally {
      cancelTimeout();
    }
  };

  /** One pull loop, page by page. Returns whether the tombstones it saw ask for a snapshot. */
  const runLoop = async (): Promise<boolean> => {
    const state = readSyncState(runtime.getDatabase());
    let cursor = state?.cursor ?? null;
    let generation = state?.generation ?? 0;
    let snapshot = false;
    let selfReset = false;

    for (let first = true; ; first = false) {
      const page = await requestPage(cursor);

      if (first && page.reset) {
        snapshot = true;
        generation += 1;
      }
      if (!page.reset && carriesMembershipTombstone(page)) selfReset = true;

      const last = !page.hasMore;
      runtime.write((transaction) => {
        applyPage(transaction, page, generation);
        if (first && snapshot && !last) {
          // Stamping the generation now, cursor and all, is what makes an interrupted snapshot
          // sweep on the next one: its rows can never share a generation with a later snapshot.
          writeSyncState(transaction, { cursor: null, generation });
        }
        if (!last) return;
        if (selfReset) {
          // The snapshot that answers the dropped cursor is the pull that counts as the last one.
          writeSyncState(transaction, { cursor: null });
          return;
        }
        if (snapshot) sweepGenerations(transaction, generation);
        writeSyncState(transaction, {
          cursor: page.cursor,
          lastPulledAt: new Date(clock.now()).toISOString(),
          generation,
        });
      });

      if (last) return selfReset;
      cursor = page.cursor;
    }
  };

  const runOnce = async (): Promise<void> => {
    if (!(await isOnline())) return;

    try {
      // A delta that saw a membership tombstone dropped its cursor, so one more loop runs and
      // the server answers with the snapshot that sweeps the rows it can no longer see. That
      // answer is a snapshot, which never self-resets, so the retry is bounded at one.
      if (await runLoop()) await runLoop();
      setStatus({ lastError: null });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setStatus({ lastError: errorMessage(error) });
    }
  };

  const drain = async (): Promise<void> => {
    setStatus({ inFlight: true });
    try {
      while (pending) {
        pending = false;
        await runOnce();
      }
    } finally {
      running = null;
      setStatus({ inFlight: false });
    }
  };

  return {
    // Single flight: a trigger during a loop is remembered, and the loop runs once more.
    pull() {
      pending = true;
      running ??= drain();
      return running;
    },

    status: () => status,
  };
}

let active: PullController | null = null;

export function installPullController(options: PullControllerOptions): PullController {
  active = createPullController(options);
  return active;
}

export function activePullController(): PullController {
  if (!active) throw new Error("The local store has no pull controller installed.");
  return active;
}
