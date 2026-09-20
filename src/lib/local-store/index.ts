import { API_URL, createApiFetch } from "@/lib/api";
import { sessionCookie } from "@/lib/session/auth-client";
import { currentClientHeaders } from "@/lib/session/client-headers";

import { deviceAppState } from "./app-state";
import { systemClock } from "./clock";
import { createExpoSqliteAdapter } from "./expo-adapter";
import type { StoreFetch } from "./fetch";
import { deviceIsOnline } from "./network";
import { createStore } from "./store";

const DATABASE_NAME = "flexi-day.db";

const apiFetch: StoreFetch = createApiFetch({
  baseUrl: API_URL,
  clientHeaders: currentClientHeaders,
  cookie: sessionCookie,
  onUnauthorized: () => store.handleUnauthorized(),
});

const store = createStore({
  adapter: createExpoSqliteAdapter(DATABASE_NAME),
  apiFetch,
  clock: systemClock,
  isOnline: deviceIsOnline,
  appState: deviceAppState,
});

export type { StoreDatabase } from "./adapter";
export type { SyncTableName } from "./envelope";
export type { StoreChannel } from "./events";
export type { PendingChange, PendingKind, VacationDraft, VacationUpdateDraft } from "./pending";
export type { PullOutcome, PullReason } from "./pull";
export type { StoreTableName } from "./schema";
export type { OpenStoreOptions } from "./store";
export type { VacationUpdate, WriteOutcome } from "./writes";
export { usePendingChanges } from "./use-pending-changes";
export { useStoreQuery } from "./use-store-query";
export { useStoreRowCounts } from "./use-store-row-counts";
export { useSyncStatus, type SyncStatus } from "./use-sync-status";

/** Opens the signed-in user's store, recreating the file when its version or its user changed. */
export const openStore = store.openStore;

/** Closes the store and deletes its file. */
export const destroyStore = store.destroyStore;

/**
 * Fetches everything the signed-in user can see, page by page, into the store. A `foreground`
 * pull is skipped while the last one is recent; `refresh` and `after-write` always run.
 */
export const pull = store.pull;

/**
 * Books leave over a range: the rows show at once as pending, the server's own rows replace them,
 * and a failure lifts them again. Failures answer with the server's message or none of their own;
 * the caller toasts, so no copy lives in here.
 */
export const createVacation = store.createVacation;

/** Edits the rows it names: the fields show at once, and the server's own rows replace them. */
export const updateVacation = store.updateVacation;

/**
 * The three decisions, single or bulk: each shows on the rows it names at once, the server
 * confirms without sending rows, and the pull that follows brings its own back over them.
 */
export const approveVacations = store.approveVacations;
export const rejectVacations = store.rejectVacations;
export const cancelVacations = store.cancelVacations;
