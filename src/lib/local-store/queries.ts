import { and, count, eq, getTableColumns, gte, lte, sql } from "drizzle-orm";

import type { StoreDatabase } from "./adapter";
import { readSyncState } from "./apply";
import { SYNC_TABLE_NAMES, type SyncTableName } from "./envelope";
import { PENDING_CHANGES_CHANNEL, type StoreChannel } from "./events";
import {
  expectedVacationPatch,
  type PendingChange,
  type VacationDraft,
  type VacationPatch,
} from "./pending";
import { bankHolidays, groups, schema, vacations } from "./schema";

export type VacationStatus = "pending" | "approved" | "rejected" | "cancelled";

/** The tables a vacation read depends on, for `useStoreQuery`. */
export const VACATION_TABLES = ["vacations"] as const satisfies readonly StoreChannel[];

/** What a merged read depends on: the rows, what a draft expands over, and the overlay itself. */
export const MERGED_VACATION_CHANNELS = [
  "vacations",
  "groups",
  "bankHolidays",
  PENDING_CHANGES_CHANNEL,
] as const satisfies readonly StoreChannel[];

export type StoredVacation = Omit<typeof vacations.$inferSelect, "generation"> & {
  status: VacationStatus;
};

export type MergedVacation = StoredVacation & {
  /** The row reads as a change in flight expects, not as the server last sent it. */
  pending: boolean;
  /** A change holds this row, so a screen leaves its actions alone until the change lifts. */
  actionsDisabled: boolean;
};

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

/** The ISO days of an inclusive range, in order; nothing for a range that reads backwards. */
function expandDays(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const days: string[] = [];
  const day = new Date(start.getTime());
  while (day.getTime() <= end.getTime()) {
    days.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return days;
}

type BookingGroup = { workingDays: number[]; holidayCountry: string | null };

/** The days a draft would actually book: the group's working days, its bank holidays dropped. */
function bookableDays(db: StoreDatabase, draft: VacationDraft, group: BookingGroup): string[] {
  const days = expandDays(draft.from, draft.to).filter((day) =>
    group.workingDays.includes(new Date(`${day}T00:00:00Z`).getUTCDay())
  );
  if (days.length === 0 || !group.holidayCountry) return days;

  const holidays = db
    .select({ date: bankHolidays.date })
    .from(bankHolidays)
    .where(
      and(
        eq(bankHolidays.country, group.holidayCountry),
        gte(bankHolidays.date, days[0]),
        lte(bankHolidays.date, days[days.length - 1])
      )
    )
    .all();
  const closed = new Set(holidays.map((holiday) => holiday.date));
  return days.filter((day) => !closed.has(day));
}

/** The rows a create shows while it is in flight, one per day the server is expected to book. */
function syntheticVacations(db: StoreDatabase, change: PendingChange): MergedVacation[] {
  const draft = change.draft;
  if (!draft) return [];

  const [group] = db
    .select({
      organizationId: groups.organizationId,
      workingDays: groups.workingDays,
      holidayCountry: groups.holidayCountry,
    })
    .from(groups)
    .where(eq(groups.id, draft.groupId))
    .all();
  // Without the group the store cannot place the rows; the answer brings them a moment later.
  if (!group) return [];

  const stamp = new Date(change.startedAt).toISOString();
  const userId = draft.userId ?? readSyncState(db)?.userId ?? "";

  return bookableDays(db, draft, group).map((day) => ({
    id: `${change.id}:${day}`,
    userId,
    groupId: draft.groupId,
    organizationId: group.organizationId,
    requestId: change.id,
    requestedDay: day,
    startTime: draft.startTime ?? null,
    endTime: draft.endTime ?? null,
    vacationType: draft.vacationType ?? "VACATION",
    halfDay: draft.halfDay ?? false,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    note: draft.note ?? null,
    createdByUserId: userId,
    deletedAt: null,
    deletedByUserId: null,
    createdAt: stamp,
    updatedAt: stamp,
    status: "pending",
    pending: true,
    actionsDisabled: true,
  }));
}

/** The same case as `vacationStatus`, over a row a change has already been laid over. */
function statusOf(
  row: Pick<StoredVacation, "approvedAt" | "rejectedAt" | "deletedAt">
): VacationStatus {
  if (row.deletedAt != null) return "cancelled";
  if (row.rejectedAt != null) return "rejected";
  if (row.approvedAt != null) return "approved";
  return "pending";
}

/** What each held row will look like if the server confirms, latest change over the ones before. */
function patchesByVacation(
  db: StoreDatabase,
  changes: readonly PendingChange[]
): Map<string, VacationPatch> {
  const patches = new Map<string, VacationPatch>();
  if (changes.length === 0) return patches;

  const userId = readSyncState(db)?.userId ?? "";
  for (const change of changes) {
    const patch = expectedVacationPatch(change, userId);
    for (const id of change.vacationIds ?? []) {
      patches.set(id, { ...patches.get(id), ...patch });
    }
  }
  return patches;
}

/**
 * The store's vacations with the overlay merged in, so a screen reads one list: a create in
 * flight contributes the rows it expects, every other change patches the rows it holds with what
 * it asked for, and all of them say their actions are off until the change lifts.
 */
export function mergedVacations(
  db: StoreDatabase,
  changes: readonly PendingChange[]
): MergedVacation[] {
  const patches = patchesByVacation(db, changes);
  const stored: MergedVacation[] = selectVacations(db)
    .all()
    .map((row) => {
      const patch = patches.get(row.id);
      if (!patch) return { ...row, pending: false, actionsDisabled: false };
      const patched = { ...row, ...patch };
      return { ...patched, status: statusOf(patched), pending: true, actionsDisabled: true };
    });

  const synthetic = changes
    .filter((change) => change.kind === "create")
    .flatMap((change) => syntheticVacations(db, change));

  return [...stored, ...synthetic].sort(
    (left, right) =>
      left.requestedDay.localeCompare(right.requestedDay) || left.id.localeCompare(right.id)
  );
}

/** How many rows the store holds in each of the pull's tables; the development card's readout. */
export function storeRowCounts(db: StoreDatabase): Record<SyncTableName, number> {
  const counts = {} as Record<SyncTableName, number>;
  for (const name of SYNC_TABLE_NAMES) {
    counts[name] = db.select({ rows: count() }).from(schema[name]).all()[0]?.rows ?? 0;
  }
  return counts;
}
