import { count, getTableColumns, sql } from "drizzle-orm";

import type { StoreDatabase } from "./adapter";
import { SYNC_TABLE_NAMES, type SyncTableName } from "./envelope";
import { schema, vacations, type StoreTableName } from "./schema";

export type VacationStatus = "pending" | "approved" | "rejected" | "cancelled";

/** The tables a vacation read depends on, for `useStoreQuery`. */
export const VACATION_TABLES = ["vacations"] as const satisfies readonly StoreTableName[];

/**
 * Status is not a column: the backend sends the three timestamps and the web derives the word from
 * them. Cancellation outranks the rest, so a cancelled booking reads as cancelled whatever it was.
 */
export const vacationStatus = sql<VacationStatus>`case
  when ${vacations.deletedAt} is not null then 'cancelled'
  when ${vacations.rejectedAt} is not null then 'rejected'
  when ${vacations.approvedAt} is not null then 'approved'
  else 'pending'
end`;

/** Every vacation the store holds, with its derived status. Callers narrow and order from here. */
export function selectVacations(db: StoreDatabase) {
  const { generation, ...columns } = getTableColumns(vacations);
  return db.select({ ...columns, status: vacationStatus }).from(vacations);
}

/** How many rows the store holds in each of the pull's tables; the development card's readout. */
export function storeRowCounts(db: StoreDatabase): Record<SyncTableName, number> {
  const counts = {} as Record<SyncTableName, number>;
  for (const name of SYNC_TABLE_NAMES) {
    counts[name] = db.select({ rows: count() }).from(schema[name]).all()[0]?.rows ?? 0;
  }
  return counts;
}
