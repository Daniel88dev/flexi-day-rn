import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { schema } from "./schema";

/**
 * The seam: everything below it is shared code. The device runs expo-sqlite, Jest runs
 * better-sqlite3, both synchronous and both on this schema and the generated DDL.
 */
export type StoreDatabase = BaseSQLiteDatabase<"sync", unknown, typeof schema>;

export type StoreConnection = {
  db: StoreDatabase;
  execute(statement: string): void;
  userVersion(): number;
  setUserVersion(version: number): void;
  close(): void;
};

export type StoreAdapter = {
  open(): StoreConnection;
  deleteDatabaseFile(): void;
};
