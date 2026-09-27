export type ReminderPrefs = {
  clockIn: {
    enabled: boolean;
    /** Wall-clock `HH:MM` on the phone. */
    time: string;
    /** `Date.getDay()` numbers; null is every working day. */
    weekdays: number[] | null;
  };
  clockOut: { enabled: boolean };
};

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  clockIn: { enabled: false, time: "08:00", weekdays: null },
  clockOut: { enabled: true },
};

export type KeyValueStorage = {
  getItemSync(key: string): string | null;
  setItemSync(key: string, value: string): void;
  removeItemSync(key: string): unknown;
};

const PREFS_KEY = "clock-reminders";
const INTRO_KEY = "notifications-intro-seen";

const TIME = /^\d{2}:\d{2}$/;

function parse(stored: string | null): ReminderPrefs {
  if (!stored) return DEFAULT_REMINDER_PREFS;
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return DEFAULT_REMINDER_PREFS;
  }
  const raw = (value ?? {}) as {
    clockIn?: Partial<ReminderPrefs["clockIn"]>;
    clockOut?: Partial<ReminderPrefs["clockOut"]>;
  };
  const clockIn = raw.clockIn ?? {};
  const clockOut = raw.clockOut ?? {};
  const defaults = DEFAULT_REMINDER_PREFS;
  return {
    clockIn: {
      enabled: typeof clockIn.enabled === "boolean" ? clockIn.enabled : defaults.clockIn.enabled,
      time:
        typeof clockIn.time === "string" && TIME.test(clockIn.time)
          ? clockIn.time
          : defaults.clockIn.time,
      weekdays: Array.isArray(clockIn.weekdays)
        ? clockIn.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        : defaults.clockIn.weekdays,
    },
    clockOut: {
      enabled: typeof clockOut.enabled === "boolean" ? clockOut.enabled : defaults.clockOut.enabled,
    },
  };
}

export type ReminderPrefsStore = {
  read(): ReminderPrefs;
  save(prefs: ReminderPrefs): void;
  subscribe(listener: () => void): () => void;
  /** The Signed-out wipe's part: the reminder settings go, the explainer's answer stays. */
  clear(): void;
  introSeen(): boolean;
  markIntroSeen(): void;
};

/** The explainer's answer lives here too: it belongs to the phone, so the wipe leaves it. */
export function createReminderPrefs(storage: KeyValueStorage): ReminderPrefsStore {
  let snapshot: ReminderPrefs | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  return {
    read() {
      snapshot ??= parse(storage.getItemSync(PREFS_KEY));
      return snapshot;
    },
    save(prefs) {
      storage.setItemSync(PREFS_KEY, JSON.stringify(prefs));
      snapshot = prefs;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      storage.removeItemSync(PREFS_KEY);
      snapshot = DEFAULT_REMINDER_PREFS;
      notify();
    },
    introSeen: () => storage.getItemSync(INTRO_KEY) === "1",
    markIntroSeen: () => storage.setItemSync(INTRO_KEY, "1"),
  };
}
