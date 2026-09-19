import type { StoreClock } from "./clock";
import { PENDING_CHANGES_CHANNEL } from "./events";
import type { StoreRuntime } from "./runtime";
import type { CalendarRecordType } from "./schema";

export type PendingKind = "create" | "update" | "approve" | "reject" | "cancel";

/**
 * What a booking was asked for, field for field the body of `POST /api/vacation/create-vacation`.
 * The store sends it as it stands and expands it into the rows it shows while the server decides.
 */
export type VacationDraft = {
  groupId: string;
  /** Inclusive `YYYY-MM-DD` range; the server fans it out into one row per working day. */
  from: string;
  to: string;
  /** A bank holiday is the admin's to grant, so nobody may request one. */
  vacationType?: Exclude<CalendarRecordType, "BANK_HOLIDAY">;
  startTime?: string | null;
  endTime?: string | null;
  halfDay?: boolean;
  note?: string | null;
  /** Booking on behalf of a member, which only an admin may do; the caller's own otherwise. */
  userId?: string;
  autoApprove?: boolean;
};

/** A write in flight, laid over the rows it targets until the server answers or the write gives up. */
export type PendingChange = {
  id: string;
  kind: PendingKind;
  vacationIds?: string[];
  draft?: VacationDraft;
  startedAt: number;
};

export type PendingChangeInput = Omit<PendingChange, "id" | "startedAt">;

export type PendingChanges = {
  list(): readonly PendingChange[];
  add(change: PendingChangeInput): PendingChange;
  remove(id: string): void;
};

export type PendingChangesOptions = {
  runtime: StoreRuntime;
  clock: StoreClock;
};

/**
 * The overlay, in memory and nowhere else: a restart mid-request leaves nothing behind and the
 * next pull tells the truth. Every transition rides the store's bus, so a merged read re-runs
 * with the same coalescing a committed transaction gets.
 */
export function createPendingChanges({ runtime, clock }: PendingChangesOptions): PendingChanges {
  let changes: readonly PendingChange[] = [];
  let sequence = 0;

  const publish = (next: readonly PendingChange[]) => {
    changes = next;
    runtime.events.emit([PENDING_CHANGES_CHANNEL]);
  };

  return {
    list: () => changes,

    add(change) {
      sequence += 1;
      const added: PendingChange = { ...change, id: `pending-${sequence}`, startedAt: clock.now() };
      publish([...changes, added]);
      return added;
    },

    remove(id) {
      const next = changes.filter((change) => change.id !== id);
      if (next.length !== changes.length) publish(next);
    },
  };
}

let active: PendingChanges | null = null;

export function installPendingChanges(options: PendingChangesOptions): PendingChanges {
  active = createPendingChanges(options);
  return active;
}

export function activePendingChanges(): PendingChanges {
  if (!active) throw new Error("The local store has no pending changes installed.");
  return active;
}
