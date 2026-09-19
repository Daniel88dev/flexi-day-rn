import { createExpoSqliteAdapter } from "./expo-adapter";
import { createStoreLifecycle } from "./lifecycle";

const DATABASE_NAME = "flexi-day.db";

const store = createStoreLifecycle(createExpoSqliteAdapter(DATABASE_NAME));

/** Opens the signed-in user's store, recreating the file when its version or its user changed. */
export function openStore(userId: string): Promise<void> {
  return store.openStore(userId);
}

/** Closes the store and deletes its file. */
export function destroyStore(): Promise<void> {
  return store.destroyStore();
}
