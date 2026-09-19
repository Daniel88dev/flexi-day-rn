import {
  eq,
  getTableColumns,
  inArray,
  lt,
  sql,
  type InferInsertModel,
  type SQL,
} from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable, SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import type { StoreDatabase } from "./adapter";
import {
  SYNC_TABLE_NAMES,
  type SyncEnvelope,
  type SyncTableName,
  type SyncVacationRow,
} from "./envelope";
import { expectedVacationPatch, type PendingChange } from "./pending";
import type { StoreRuntime, StoreTransaction } from "./runtime";
import {
  bankHolidays,
  groupMirrors,
  groupUsers,
  groups,
  organizations,
  syncState,
  userYearQuotas,
  users,
  vacations,
} from "./schema";

/** SQLite binds a limited number of parameters per statement, so a page's rows go in as chunks. */
const MAX_BOUND_PARAMETERS = 900;

const SYNC_STATE_ID = 1;

/** What applying a row needs of it: its key, and the tombstone marker where the table has one. */
type SyncRowKey = { id: string; deletedAt?: string | null };

/** What a page's tombstone means for the table it arrives in. */
type TombstonePolicy = "delete" | "keep";

type SyncedTable = SQLiteTable & { id: SQLiteColumn; generation: SQLiteColumn };

const SYNC_TABLES: {
  [TName in SyncTableName]: { table: SyncedTable; tombstones: TombstonePolicy };
} = {
  organizations: { table: organizations, tombstones: "keep" },
  users: { table: users, tombstones: "keep" },
  groups: { table: groups, tombstones: "delete" },
  groupUsers: { table: groupUsers, tombstones: "delete" },
  groupMirrors: { table: groupMirrors, tombstones: "delete" },
  userYearQuotas: { table: userYearQuotas, tombstones: "keep" },
  bankHolidays: { table: bankHolidays, tombstones: "keep" },
  vacations: { table: vacations, tombstones: "keep" },
};

function chunks<TItem>(items: TItem[], size: number): TItem[][] {
  const chunked: TItem[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunked.push(items.slice(start, start + size));
  }
  return chunked;
}

/** A pull sends whole rows, so a conflict replaces every column but the key. */
function replacedColumns<TTable extends SQLiteTable>(table: TTable): SQLiteUpdateSetSource<TTable> {
  const set: Record<string, SQL> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (key !== "id") set[key] = sql`excluded.${sql.identifier(column.name)}`;
  }
  return set as SQLiteUpdateSetSource<TTable>;
}

function applyRows<TTable extends SyncedTable>(
  transaction: StoreTransaction,
  name: SyncTableName,
  table: TTable,
  rows: (InferInsertModel<TTable> & SyncRowKey)[],
  generation: number,
  tombstones: TombstonePolicy
): void {
  if (rows.length === 0) return;

  const tombstoned = tombstones === "delete" ? rows.filter((row) => row.deletedAt != null) : [];
  const upserted = tombstoned.length === 0 ? rows : rows.filter((row) => row.deletedAt == null);
  const columnCount = Object.keys(getTableColumns(table)).length;

  for (const chunk of chunks(
    upserted,
    Math.max(1, Math.floor(MAX_BOUND_PARAMETERS / columnCount))
  )) {
    transaction.db
      .insert(table)
      .values(chunk.map((row) => ({ ...row, generation })))
      .onConflictDoUpdate({ target: table.id, set: replacedColumns(table) })
      .run();
  }

  let deleted = 0;
  for (const chunk of chunks(tombstoned, MAX_BOUND_PARAMETERS)) {
    deleted += transaction.db
      .delete(table)
      .where(
        inArray(
          table.id,
          chunk.map((row) => row.id)
        )
      )
      .run().changes;
  }

  if (upserted.length > 0 || deleted > 0) transaction.touch(name);
}

/**
 * Applies one page of the sync pull, tables in the envelope's order, every row stamped with the
 * generation. A cancelled booking upserts like any other row, so the phone keeps it as history.
 */
export function applyPage(
  transaction: StoreTransaction,
  page: SyncEnvelope,
  generation: number
): void {
  for (const name of SYNC_TABLE_NAMES) {
    const { table, tombstones } = SYNC_TABLES[name];
    applyRows(transaction, name, table, page[name], generation, tombstones);
  }
}

/**
 * Upserts the rows a write just had confirmed, stamped with the generation the pull is on so a
 * later snapshot sweeps them exactly as it sweeps rows it sent itself.
 */
function applyWrittenVacations(transaction: StoreTransaction, rows: SyncVacationRow[]): void {
  const generation = readSyncState(transaction.db)?.generation ?? 0;
  applyRows(transaction, "vacations", vacations, rows, generation, "keep");
}

/** The row a write's answer carries: the table's columns, minus the organization. */
type WrittenVacation = Omit<SyncVacationRow, "organizationId">;

function organizationIdsByGroup(db: StoreDatabase, groupIds: string[]): Map<string, string> {
  if (groupIds.length === 0) return new Map();
  const rows = db
    .select({ id: groups.id, organizationId: groups.organizationId })
    .from(groups)
    .where(inArray(groups.id, groupIds))
    .all();
  return new Map(rows.map((row) => [row.id, row.organizationId]));
}

/** The answer carries no organization, so each row takes its group's before it is stored. */
export function storeWrittenVacations(runtime: StoreRuntime, body: unknown): void {
  const written = (Array.isArray(body) ? body : []) as WrittenVacation[];
  // Signing out closes the store under a write in flight; the rows are the server's either way.
  if (written.length === 0 || !runtime.isOpen()) return;

  runtime.write((transaction) => {
    const organizations = organizationIdsByGroup(
      transaction.db,
      written.map((row) => row.groupId)
    );
    const rows = written.flatMap<SyncVacationRow>((row) => {
      // A group the store has never pulled cannot place its rows; the next pull brings them.
      const organizationId = organizations.get(row.groupId);
      return organizationId ? [{ ...row, organizationId }] : [];
    });
    if (rows.length > 0) applyWrittenVacations(transaction, rows);
  });
}

/**
 * What a confirmation carrying no rows leaves behind: the patch the change expected, over the rows
 * it held and stamped like a pulled row, until the pull that follows replaces it with the server's.
 */
export function storeProvisionalVacations(runtime: StoreRuntime, change: PendingChange): void {
  const ids = change.vacationIds ?? [];
  // Signing out closes the store under a write in flight; the decision is the server's either way.
  if (ids.length === 0 || !runtime.isOpen()) return;

  runtime.write((transaction) => {
    const state = readSyncState(transaction.db);
    const patch = expectedVacationPatch(change, state?.userId ?? "");
    let changed = 0;
    for (const chunk of chunks(ids, MAX_BOUND_PARAMETERS)) {
      changed += transaction.db
        .update(vacations)
        .set({ ...patch, generation: state?.generation ?? 0 })
        .where(inArray(vacations.id, chunk))
        .run().changes;
    }
    if (changed > 0) transaction.touch("vacations");
  });
}

/** Drops what a snapshot did not re-send: every row still stamped with an earlier generation. */
export function sweepGenerations(transaction: StoreTransaction, generation: number): void {
  for (const name of SYNC_TABLE_NAMES) {
    const { table } = SYNC_TABLES[name];
    const { changes } = transaction.db.delete(table).where(lt(table.generation, generation)).run();
    if (changes > 0) transaction.touch(name);
  }
}

export type SyncStatePatch = {
  cursor?: string | null;
  lastPulledAt?: string | null;
  generation?: number;
};

export type SyncStateRow = typeof syncState.$inferSelect;

/** Where the store stopped: the cursor, the time it was written and the generation it holds. */
export function readSyncState(db: StoreDatabase): SyncStateRow | null {
  return db.select().from(syncState).where(eq(syncState.id, SYNC_STATE_ID)).all()[0] ?? null;
}

export function writeSyncState(transaction: StoreTransaction, patch: SyncStatePatch): void {
  transaction.db.update(syncState).set(patch).where(eq(syncState.id, SYNC_STATE_ID)).run();
  transaction.touch("syncState");
}
