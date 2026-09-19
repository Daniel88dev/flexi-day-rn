import { createExpoSqliteAdapter } from "./expo-adapter";
import { installStoreRuntime } from "./runtime";

const DATABASE_NAME = "flexi-day.db";

const store = installStoreRuntime(createExpoSqliteAdapter(DATABASE_NAME));

export type { StoreDatabase } from "./adapter";
export type { StoreTableName } from "./schema";
export { useStoreQuery } from "./use-store-query";

/** Opens the signed-in user's store, recreating the file when its version or its user changed. */
export function openStore(userId: string): Promise<void> {
  return store.lifecycle.openStore(userId);
}

/** Closes the store and deletes its file. */
export function destroyStore(): Promise<void> {
  return store.lifecycle.destroyStore();
}
