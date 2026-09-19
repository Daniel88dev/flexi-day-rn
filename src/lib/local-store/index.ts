import { API_URL } from "@/lib/api";

import { systemClock } from "./clock";
import { createExpoSqliteAdapter } from "./expo-adapter";
import { deviceIsOnline } from "./network";
import type { SyncFetch } from "./pull";
import { createStore } from "./store";

const DATABASE_NAME = "flexi-day.db";

/** The session's request wrapper lands here; until then the pull carries no cookie and is 401ed. */
const syncFetch: SyncFetch = (path, init) => fetch(`${API_URL}${path}`, init);

const store = createStore({
  adapter: createExpoSqliteAdapter(DATABASE_NAME),
  fetchPage: syncFetch,
  clock: systemClock,
  isOnline: deviceIsOnline,
});

export type { StoreDatabase } from "./adapter";
export type { SyncTableName } from "./envelope";
export type { PullReason } from "./pull";
export type { StoreTableName } from "./schema";
export type { OpenStoreOptions } from "./store";
export { useStoreQuery } from "./use-store-query";
export { useStoreRowCounts } from "./use-store-row-counts";
export { useSyncStatus, type SyncStatus } from "./use-sync-status";

/** Opens the signed-in user's store, recreating the file when its version or its user changed. */
export const openStore = store.openStore;

/** Closes the store and deletes its file. */
export const destroyStore = store.destroyStore;

/** Fetches everything the signed-in user can see, page by page, into the store. */
export const pull = store.pull;
