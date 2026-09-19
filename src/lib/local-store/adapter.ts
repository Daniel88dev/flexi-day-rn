import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { schema } from "./schema";

/** What both drivers report back from a statement; the sweep reads it to know what it deleted. */
export type StoreRunResult = { changes: number };

/**
 * The seam: everything below it is shared code. The device runs expo-sqlite, Jest runs
 * better-sqlite3, both synchronous and both on this schema and the generated DDL.
 */
export type StoreDatabase = BaseSQLiteDatabase<"sync", StoreRunResult, typeof schema>;

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
