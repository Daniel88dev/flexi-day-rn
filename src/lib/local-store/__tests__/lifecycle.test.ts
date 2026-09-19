import { sql } from "drizzle-orm";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { StoreAdapter, StoreDatabase } from "../adapter";
import { createStoreLifecycle } from "../lifecycle";
import { organizations, syncState } from "../schema";
import { createBetterSqlite3Adapter } from "../test-support/better-sqlite3-adapter";
import { STORE_VERSION } from "../version";

const SYNCED_TABLES = [
  "bankHolidays",
  "groupMirrors",
  "groupUsers",
  "groups",
  "organizations",
  "userYearQuotas",
  "users",
  "vacations",
];

let directory: string;
let filePath: string;
let adapter: StoreAdapter;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "flexi-store-"));
  filePath = join(directory, "store.db");
  adapter = createBetterSqlite3Adapter(filePath);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function tableNames(db: StoreDatabase): string[] {
  const rows = db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name`
  );
  return rows.map((row) => row.name);
}

function userVersion(): number {
  const connection = adapter.open();
  try {
    return connection.userVersion();
  } finally {
    connection.close();
  }
}

describe("openStore", () => {
  it("creates every synced table, the sync state row and the store version", async () => {
    const store = createStoreLifecycle(adapter);

    await store.openStore("user-1");
    const db = store.getDatabase();

    expect(tableNames(db)).toEqual([...SYNCED_TABLES, "syncState"].sort());
    expect(db.select().from(syncState).all()).toEqual([
      { id: 1, userId: "user-1", cursor: null, lastPulledAt: null, generation: 0 },
    ]);
  });

  it("stamps PRAGMA user_version with the store version", async () => {
    const store = createStoreLifecycle(adapter);

    await store.openStore("user-1");
    expect(store.getDatabase().all<{ user_version: number }>(sql`PRAGMA user_version`)).toEqual([
      { user_version: STORE_VERSION },
    ]);
  });

  it("keeps the rows when the same user opens the store again", async () => {
    const first = createStoreLifecycle(adapter);
    await first.openStore("user-1");
    first.getDatabase().insert(organizations).values({ id: "org-1", name: "Northwind" }).run();
    await first.closeStore();

    const second = createStoreLifecycle(adapter);
    await second.openStore("user-1");

    expect(second.getDatabase().select().from(organizations).all()).toHaveLength(1);
  });

  it("returns the same database when called twice in one launch", async () => {
    const store = createStoreLifecycle(adapter);

    await store.openStore("user-1");
    const first = store.getDatabase();
    store.getDatabase().insert(organizations).values({ id: "org-1", name: "Northwind" }).run();
    await store.openStore("user-1");

    expect(store.getDatabase()).toBe(first);
    expect(store.getDatabase().select().from(organizations).all()).toHaveLength(1);
  });

  it("deletes and recreates the file when the stored store version differs", async () => {
    const old = createStoreLifecycle(adapter, STORE_VERSION);
    await old.openStore("user-1");
    old.getDatabase().insert(organizations).values({ id: "org-1", name: "Northwind" }).run();
    await old.closeStore();

    const next = createStoreLifecycle(adapter, STORE_VERSION + 1);
    await next.openStore("user-1");

    expect(next.getDatabase().select().from(organizations).all()).toEqual([]);
    expect(tableNames(next.getDatabase())).toEqual([...SYNCED_TABLES, "syncState"].sort());
    await next.closeStore();
    expect(userVersion()).toBe(STORE_VERSION + 1);
  });

  it("wipes the file and starts over when a different user opens it", async () => {
    const first = createStoreLifecycle(adapter);
    await first.openStore("user-1");
    first.getDatabase().insert(organizations).values({ id: "org-1", name: "Northwind" }).run();
    await first.closeStore();

    const second = createStoreLifecycle(adapter);
    await second.openStore("user-2");

    expect(second.getDatabase().select().from(organizations).all()).toEqual([]);
    expect(second.getDatabase().select().from(syncState).all()).toEqual([
      { id: 1, userId: "user-2", cursor: null, lastPulledAt: null, generation: 0 },
    ]);
  });

  it("wipes the file when a different user signs in without a restart", async () => {
    const store = createStoreLifecycle(adapter);
    await store.openStore("user-1");
    store.getDatabase().insert(organizations).values({ id: "org-1", name: "Northwind" }).run();

    await store.openStore("user-2");

    expect(store.getDatabase().select().from(organizations).all()).toEqual([]);
  });

  it("recreates a file that carries the version but lost its tables", async () => {
    const stamped = adapter.open();
    stamped.setUserVersion(STORE_VERSION);
    stamped.close();

    const store = createStoreLifecycle(adapter);
    await store.openStore("user-1");

    expect(tableNames(store.getDatabase())).toEqual([...SYNCED_TABLES, "syncState"].sort());
    expect(store.getDatabase().select().from(syncState).all()).toHaveLength(1);
  });

  it("throws when the database is read before the store is open", () => {
    const store = createStoreLifecycle(adapter);

    expect(() => store.getDatabase()).toThrow();
  });
});

describe("destroyStore", () => {
  it("deletes the file", async () => {
    const store = createStoreLifecycle(adapter);
    await store.openStore("user-1");

    await store.destroyStore();

    expect(existsSync(filePath)).toBe(false);
  });

  it("opens again in the same process after a destroy", async () => {
    const store = createStoreLifecycle(adapter);
    await store.openStore("user-1");
    store.getDatabase().insert(organizations).values({ id: "org-1", name: "Northwind" }).run();
    await store.destroyStore();

    await store.openStore("user-1");

    expect(store.getDatabase().select().from(organizations).all()).toEqual([]);
    expect(existsSync(filePath)).toBe(true);
  });

  it("does nothing when no store was ever opened", async () => {
    const store = createStoreLifecycle(adapter);

    await expect(store.destroyStore()).resolves.toBeUndefined();
    expect(existsSync(filePath)).toBe(false);
  });

  it("is safe to call twice", async () => {
    const store = createStoreLifecycle(adapter);
    await store.openStore("user-1");

    await store.destroyStore();
    await expect(store.destroyStore()).resolves.toBeUndefined();
  });
});
