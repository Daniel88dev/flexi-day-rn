import { createReminderScheduler, type Notifier, type ScheduledReminder } from "../apply";
import type { PlannedReminder } from "../plan";

const copy = {
  "clock-in": { title: "Clock in", body: "Starting work? Clock in if you haven't yet." },
  "clock-out": { title: "Clock out", body: "Done for today? Clock out if you haven't yet." },
};

function fakeNotifier(seed: ScheduledReminder[] = []) {
  const held = new Map(seed.map((entry) => [entry.identifier, entry]));
  const calls: string[] = [];
  const notifier: Notifier = {
    scheduled: async () => [...held.values()],
    cancel: async (identifier) => {
      calls.push(`cancel ${identifier}`);
      held.delete(identifier);
    },
    schedule: async (entry) => {
      calls.push(`schedule ${entry.identifier}`);
      held.set(entry.identifier, entry);
    },
  };
  return { notifier, calls, ids: () => [...held.keys()].sort(), held };
}

const planned = (id: string, fireAt: number): PlannedReminder => ({
  id,
  kind: id === "clock-out" ? "clock-out" : "clock-in",
  fireAt,
});

const someoneElses: ScheduledReminder = {
  identifier: "request-update",
  title: "Approved",
  body: "Your time off was approved.",
  fireAt: 1,
  data: {},
};

describe("createReminderScheduler", () => {
  it("schedules every planned reminder with its copy and the clock sheet as its link", async () => {
    const { notifier, held } = fakeNotifier();

    await createReminderScheduler(notifier).apply([planned("clock-in:2026-09-29", 1000)], copy);

    expect(held.get("clock-in:2026-09-29")).toEqual({
      identifier: "clock-in:2026-09-29",
      title: "Clock in",
      body: "Starting work? Clock in if you haven't yet.",
      fireAt: 1000,
      data: { url: "/clock", fireAt: 1000 },
    });
  });

  it("cancels the clock reminders no longer planned and leaves every other notification alone", async () => {
    const { notifier, ids } = fakeNotifier();
    const scheduler = createReminderScheduler(notifier);
    await scheduler.apply([planned("clock-in:2026-09-29", 1000), planned("clock-out", 500)], copy);
    await notifier.schedule(someoneElses);

    await scheduler.apply([planned("clock-in:2026-09-30", 2000)], copy);

    expect(ids()).toEqual(["clock-in:2026-09-30", "request-update"]);
  });

  it("touches nothing when the same plan applies twice", async () => {
    const { notifier, calls } = fakeNotifier();
    const scheduler = createReminderScheduler(notifier);
    const plan = [planned("clock-in:2026-09-29", 1000), planned("clock-out", 500)];
    await scheduler.apply(plan, copy);
    calls.length = 0;

    await scheduler.apply(plan, copy);

    expect(calls).toEqual([]);
  });

  it("replaces a reminder whose moment or copy changed", async () => {
    const { notifier, calls, held } = fakeNotifier();
    const scheduler = createReminderScheduler(notifier);
    await scheduler.apply([planned("clock-out", 500), planned("clock-in:2026-09-29", 1000)], copy);
    calls.length = 0;

    await scheduler.apply([planned("clock-out", 600), planned("clock-in:2026-09-29", 1000)], {
      ...copy,
      "clock-in": { title: "Příchod", body: "Začínáte pracovat?" },
    });

    expect(calls.sort()).toEqual(["schedule clock-in:2026-09-29", "schedule clock-out"]);
    expect(held.get("clock-out")?.fireAt).toBe(600);
  });

  it("clears every clock reminder and nothing else", async () => {
    const { notifier, ids } = fakeNotifier([someoneElses]);
    const scheduler = createReminderScheduler(notifier);
    await scheduler.apply([planned("clock-in:2026-09-29", 1000), planned("clock-out", 500)], copy);

    await scheduler.clear();

    expect(ids()).toEqual(["request-update"]);
  });

  it("clears after an apply still in flight, so nothing it scheduled survives", async () => {
    const { notifier, ids } = fakeNotifier();
    const scheduler = createReminderScheduler(notifier);

    const applying = scheduler.apply([planned("clock-in:2026-09-29", 1000)], copy);
    const clearing = scheduler.clear();
    await Promise.all([applying, clearing]);

    expect(ids()).toEqual([]);
  });

  it("schedules nothing after a clear until it is armed again", async () => {
    const { notifier, ids } = fakeNotifier();
    const scheduler = createReminderScheduler(notifier);
    await scheduler.apply([planned("clock-out", 500)], copy);

    const clearing = scheduler.clear();
    const lateApply = scheduler.apply([planned("clock-out", 500)], copy);
    await Promise.all([clearing, lateApply]);
    expect(ids()).toEqual([]);

    scheduler.arm();
    await scheduler.apply([planned("clock-out", 500)], copy);
    expect(ids()).toEqual(["clock-out"]);
  });

  it("keeps going after a notifier that fails once", async () => {
    const { notifier, ids } = fakeNotifier();
    const failing: Notifier = {
      ...notifier,
      scheduled: jest
        .fn()
        .mockRejectedValueOnce(new Error("no"))
        .mockImplementation(notifier.scheduled),
    };
    const scheduler = createReminderScheduler(failing);

    await scheduler.apply([planned("clock-out", 500)], copy);
    await scheduler.apply([planned("clock-out", 500)], copy);

    expect(ids()).toEqual(["clock-out"]);
  });
});
