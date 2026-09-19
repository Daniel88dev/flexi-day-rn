import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";

import type { StoreAdapter, StoreConnection, StoreDatabase } from "./adapter";
import { schema } from "./schema";

export function createExpoSqliteAdapter(databaseName: string): StoreAdapter {
  return {
    open(): StoreConnection {
      const client = SQLite.openDatabaseSync(databaseName);
      const db: StoreDatabase = drizzle(client, { schema });
      return {
        db,
        execute: (statement) => {
          client.execSync(statement);
        },
        userVersion: () =>
          client.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0,
        setUserVersion: (version) => {
          client.execSync(`PRAGMA user_version = ${version}`);
        },
        close: () => {
          client.closeSync();
        },
      };
    },
    deleteDatabaseFile() {
      try {
        SQLite.deleteDatabaseSync(databaseName);
      } catch {
        // expo-sqlite throws when the file is not there, which is the state a delete wants.
      }
    },
  };
}
