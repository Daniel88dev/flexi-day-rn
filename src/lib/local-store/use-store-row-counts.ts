import { SYNC_TABLE_NAMES, type SyncTableName } from "./envelope";
import { storeRowCounts } from "./queries";
import { useStoreQuery } from "./use-store-query";

/** How many rows the store holds in each table of the pull, re-read as pages land. */
export function useStoreRowCounts(): Record<SyncTableName, number> {
  return useStoreQuery(storeRowCounts, SYNC_TABLE_NAMES);
}
