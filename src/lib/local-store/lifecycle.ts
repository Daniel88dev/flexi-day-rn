import type { StoreAdapter, StoreConnection, StoreDatabase } from "./adapter";
import { STORE_DDL } from "./ddl.generated";
import { syncState } from "./schema";
import { STORE_VERSION } from "./version";

export type StoreLifecycle = {
  openStore(userId: string): Promise<void>;
  destroyStore(): Promise<void>;
  closeStore(): Promise<void>;
  getDatabase(): StoreDatabase;
};

function createSchema(connection: StoreConnection, userId: string, storeVersion: number): void {
  for (const statement of STORE_DDL) {
    connection.execute(statement);
  }
  connection.setUserVersion(storeVersion);
  connection.db.insert(syncState).values({ id: 1, userId }).run();
}

function storedUserId(connection: StoreConnection): string | null {
  try {
    const [row] = connection.db.select({ userId: syncState.userId }).from(syncState).all();
    return row?.userId ?? null;
  } catch {
    // A file stamped with the version but missing its tables: a half-failed wipe, recreated below.
    return null;
  }
}

/**
 * The store's persistence, over either adapter. The store is a cache and never migrates: a file
 * written by another version of the schema, or by another user, is deleted and created again.
 */
export function createStoreLifecycle(
  adapter: StoreAdapter,
  storeVersion: number = STORE_VERSION
): StoreLifecycle {
  let connection: StoreConnection | null = null;
  let openUserId: string | null = null;

  const recreate = (userId: string): StoreConnection => {
    connection?.close();
    connection = null;
    adapter.deleteDatabaseFile();
    const fresh = adapter.open();
    createSchema(fresh, userId, storeVersion);
    return fresh;
  };

  return {
    async openStore(userId) {
      if (connection && openUserId === userId) return;

      connection?.close();
      connection = adapter.open();

      const stale =
        connection.userVersion() !== storeVersion || storedUserId(connection) !== userId;
      if (stale) connection = recreate(userId);

      openUserId = userId;
    },

    async destroyStore() {
      connection?.close();
      connection = null;
      openUserId = null;
      adapter.deleteDatabaseFile();
    },

    /** Closes without deleting, so a test can reopen the file the way a relaunch would. */
    async closeStore() {
      connection?.close();
      connection = null;
      openUserId = null;
    },

    getDatabase() {
      if (!connection) throw new Error("The local store is not open.");
      return connection.db;
    },
  };
}
