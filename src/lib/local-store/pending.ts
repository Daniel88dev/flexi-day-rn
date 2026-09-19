import type { StoreClock } from "./clock";
import { PENDING_CHANGES_CHANNEL } from "./events";
import type { StoreRuntime } from "./runtime";
import type { CalendarRecordType, vacations } from "./schema";

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

/**
 * What an edit asks for, field for field the body of `PATCH /api/vacation` with the ids left out.
 * A field the caller left out stays as it is; `null` clears it.
 */
export type VacationUpdateDraft = {
  vacationType?: Exclude<CalendarRecordType, "BANK_HOLIDAY">;
  startTime?: string | null;
  endTime?: string | null;
  halfDay?: boolean;
  note?: string | null;
};

/** A write in flight, laid over the rows it targets until the server answers or the write gives up. */
export type PendingChange = {
  id: string;
  kind: PendingKind;
  vacationIds?: string[];
  draft?: VacationDraft;
  update?: VacationUpdateDraft;
  /** What the decision was given for, which a rejection keeps on the row it refused. */
  reason?: string;
  startedAt: number;
};

/** The columns a change in flight writes over the rows it holds. */
export type VacationPatch = Partial<
  Pick<
    typeof vacations.$inferSelect,
    | "vacationType"
    | "startTime"
    | "endTime"
    | "halfDay"
    | "note"
    | "approvedAt"
    | "approvedBy"
    | "rejectedAt"
    | "rejectedBy"
    | "rejectionReason"
    | "deletedAt"
    | "deletedByUserId"
  >
>;

function definedFields(update: VacationUpdateDraft): VacationPatch {
  return Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined)
  ) as VacationPatch;
}

/**
 * What the server is expected to write for a change in flight: the rows read this way while it is
 * in flight, and a confirmation that carries no rows of its own is stored as exactly this.
 */
export function expectedVacationPatch(change: PendingChange, userId: string): VacationPatch {
  const at = new Date(change.startedAt).toISOString();
  switch (change.kind) {
    case "update":
      return change.update ? definedFields(change.update) : {};
    case "approve":
      return { approvedAt: at, approvedBy: userId };
    case "reject":
      return { rejectedAt: at, rejectedBy: userId, rejectionReason: change.reason ?? null };
    case "cancel":
      return { deletedAt: at, deletedByUserId: userId };
    case "create":
      // A create holds no stored row; it expands into rows of its own.
      return {};
  }
}

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
