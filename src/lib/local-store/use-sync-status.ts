import { readSyncState } from "./apply";
import { activePullController } from "./pull";
import type { StoreTableName } from "./schema";
import { useStoreQuery } from "./use-store-query";

export type SyncStatus = {
  inFlight: boolean;
  lastPulledAt: string | null;
  lastError: string | null;
  /** The cursor itself never leaves the module; whether one is stored says the store is caught up. */
  hasCursor: boolean;
  generation: number;
};

const SYNC_STATE_TABLES = ["syncState"] as const satisfies readonly StoreTableName[];

/** What the pull loop has done: persisted in `syncState`, transient in the loop, one event bus. */
export function useSyncStatus(): SyncStatus {
  const state = useStoreQuery(readSyncState, SYNC_STATE_TABLES);
  const { inFlight, lastError } = activePullController().status();

  return {
    inFlight,
    lastError,
    lastPulledAt: state?.lastPulledAt ?? null,
    hasCursor: state?.cursor != null,
    generation: state?.generation ?? 0,
  };
}
