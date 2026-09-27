import { createReminderPrefs, DEFAULT_REMINDER_PREFS, type KeyValueStorage } from "../prefs";

function fakeStorage(seed: Record<string, string> = {}): KeyValueStorage & {
  entries(): Record<string, string>;
} {
  const held = new Map(Object.entries(seed));
  return {
    getItemSync: (key) => held.get(key) ?? null,
    setItemSync: (key, value) => void held.set(key, value),
    removeItemSync: (key) => held.delete(key),
    entries: () => Object.fromEntries(held),
  };
}

describe("createReminderPrefs", () => {
  it("returns the defaults on a phone that stored none: clock-in off at 08:00 on every working day, clock-out on", () => {
    const prefs = createReminderPrefs(fakeStorage());

    expect(prefs.read()).toEqual({
      clockIn: { enabled: false, time: "08:00", weekdays: null },
      clockOut: { enabled: true },
    });
  });

  it("returns what was saved, across a new instance on the same storage", () => {
    const storage = fakeStorage();
    createReminderPrefs(storage).save({
      clockIn: { enabled: true, time: "07:30", weekdays: [1, 2, 3] },
      clockOut: { enabled: false },
    });

    expect(createReminderPrefs(storage).read()).toEqual({
      clockIn: { enabled: true, time: "07:30", weekdays: [1, 2, 3] },
      clockOut: { enabled: false },
    });
  });

  it("returns the defaults for anything stored it cannot read", () => {
    const storage = fakeStorage({ "clock-reminders": "{not json" });

    expect(createReminderPrefs(storage).read()).toEqual(DEFAULT_REMINDER_PREFS);
  });

  it("fills a field a stored value lacks from the defaults", () => {
    const storage = fakeStorage({
      "clock-reminders": JSON.stringify({ clockIn: { enabled: true, time: "09:15" } }),
    });

    expect(createReminderPrefs(storage).read()).toEqual({
      clockIn: { enabled: true, time: "09:15", weekdays: null },
      clockOut: { enabled: true },
    });
  });

  it("tells subscribers about a save, and keeps the snapshot's identity between saves", () => {
    const prefs = createReminderPrefs(fakeStorage());
    const listener = jest.fn();
    prefs.subscribe(listener);
    const before = prefs.read();

    expect(prefs.read()).toBe(before);
    prefs.save({ ...before, clockOut: { enabled: false } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(prefs.read().clockOut.enabled).toBe(false);
  });

  it("clears back to the defaults and deletes what it stored, keeping the explainer's answer", () => {
    const storage = fakeStorage();
    const prefs = createReminderPrefs(storage);
    prefs.save({
      ...DEFAULT_REMINDER_PREFS,
      clockIn: { enabled: true, time: "07:00", weekdays: null },
    });
    prefs.markIntroSeen();

    prefs.clear();

    expect(prefs.read()).toEqual(DEFAULT_REMINDER_PREFS);
    expect(storage.entries()["clock-reminders"]).toBeUndefined();
    expect(prefs.introSeen()).toBe(true);
  });

  it("returns the explainer unseen until it is marked", () => {
    const storage = fakeStorage();
    const prefs = createReminderPrefs(storage);

    expect(prefs.introSeen()).toBe(false);
    prefs.markIntroSeen();
    expect(createReminderPrefs(storage).introSeen()).toBe(true);
  });
});
