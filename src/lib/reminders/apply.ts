import type { PlannedReminder, ReminderKind } from "./plan";

export const CLOCK_SHEET_URL = "/clock";

export const CLOCK_REMINDER_PREFIX = "clock-";

export type ScheduledReminder = {
  identifier: string;
  title: string | null;
  body: string | null;
  fireAt: number;
  data: Record<string, unknown>;
};

export type Notifier = {
  scheduled(): Promise<ScheduledReminder[]>;
  cancel(identifier: string): Promise<void>;
  schedule(reminder: ScheduledReminder): Promise<void>;
};

export type ReminderCopy = Record<ReminderKind, { title: string; body: string }>;

export type ReminderScheduler = {
  apply(plan: readonly PlannedReminder[], copy: ReminderCopy): Promise<void>;
  /** Also disarms: the wipe's clear must not be undone by a plan still rendering behind it. */
  clear(): Promise<void>;
  arm(): void;
};

function toScheduled(entry: PlannedReminder, copy: ReminderCopy): ScheduledReminder {
  const { title, body } = copy[entry.kind];
  return {
    identifier: entry.id,
    title,
    body,
    fireAt: entry.fireAt,
    data: { url: CLOCK_SHEET_URL, fireAt: entry.fireAt },
  };
}

// The request iOS hands back carries its trigger in a shape of its own, so the moment is read
// from the data it was scheduled with.
const unchanged = (held: ScheduledReminder, wanted: ScheduledReminder) =>
  held.data.fireAt === wanted.fireAt && held.title === wanted.title && held.body === wanted.body;

// Every apply and clear runs after the one before it, so a clear that lands while a plan is
// still being scheduled leaves nothing of it behind.
export function createReminderScheduler(notifier: Notifier): ReminderScheduler {
  let queue: Promise<void> = Promise.resolve();
  let armed = true;
  const enqueue = (work: () => Promise<void>) => {
    const next = queue.then(work).catch((error: unknown) => {
      console.warn("Clock reminders could not be updated.", error);
    });
    queue = next;
    return next;
  };

  const ours = async () =>
    (await notifier.scheduled()).filter((entry) =>
      entry.identifier.startsWith(CLOCK_REMINDER_PREFIX)
    );

  return {
    apply: (plan, copy) => {
      if (!armed) return queue;
      return enqueue(async () => {
        const held = new Map((await ours()).map((entry) => [entry.identifier, entry]));
        const wanted = plan.map((entry) => toScheduled(entry, copy));
        const wantedIds = new Set(wanted.map((entry) => entry.identifier));

        for (const identifier of held.keys()) {
          if (!wantedIds.has(identifier)) await notifier.cancel(identifier);
        }
        for (const entry of wanted) {
          const existing = held.get(entry.identifier);
          if (!existing || !unchanged(existing, entry)) await notifier.schedule(entry);
        }
      });
    },
    clear: () => {
      armed = false;
      return enqueue(async () => {
        for (const entry of await ours()) await notifier.cancel(entry.identifier);
      });
    },
    arm: () => {
      armed = true;
    },
  };
}
