import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { rmSync } from "node:fs";

import type { StoreAdapter, StoreConnection, StoreDatabase } from "../adapter";
import { schema } from "../schema";

/**
 * The Jest half of the store's seam. Not reachable from the module's index, so it never
 * reaches a bundle.
 */
export function createBetterSqlite3Adapter(filePath: string): StoreAdapter {
  return {
    open(): StoreConnection {
      const client = new BetterSqlite3(filePath);
      const db: StoreDatabase = drizzle(client, { schema });
      return {
        db,
        execute: (statement) => {
          client.exec(statement);
        },
        userVersion: () => client.pragma("user_version", { simple: true }) as number,
        setUserVersion: (version) => {
          client.pragma(`user_version = ${version}`);
        },
        close: () => client.close(),
      };
    },
    deleteDatabaseFile() {
      rmSync(filePath, { force: true });
      rmSync(`${filePath}-wal`, { force: true });
      rmSync(`${filePath}-shm`, { force: true });
    },
  };
}
