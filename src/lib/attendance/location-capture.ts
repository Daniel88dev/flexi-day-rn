import { clockStatusOf } from "./clock";
import type { AttendanceState } from "./types";

export type LocationEnd = "IN" | "OUT";

export type Reading = { latitude: number; longitude: number; accuracy: number | null };

export type LocationFix = {
  end: LocationEnd;
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type LocationDevice = {
  servicesEnabled: () => Promise<boolean>;
  requestPermission: () => Promise<{ granted: boolean; reduced: boolean }>;
  lastKnown: (maxAgeMs: number) => Promise<Reading | null>;
  current: (accuracy: "balanced" | "highest") => Promise<Reading>;
};

export type LocationEvent =
  | { kind: "finding"; end: LocationEnd }
  | {
      kind: "saved";
      end: LocationEnd;
      pass: "coarse" | "precise";
      accuracy: number;
      reduced: boolean;
    }
  | { kind: "done"; end: LocationEnd };

const LAST_KNOWN_MAX_AGE = 60_000;

type Pass = {
  pass: "coarse" | "precise";
  timeoutMs: number;
  read: (device: LocationDevice) => Promise<Reading>;
};

const PASSES: Pass[] = [
  {
    pass: "coarse",
    timeoutMs: 8_000,
    read: async (device) =>
      (await device.lastKnown(LAST_KNOWN_MAX_AGE)) ?? device.current("balanced"),
  },
  { pass: "precise", timeoutMs: 30_000, read: (device) => device.current("highest") },
];

/**
 * The reading, or null once it fails, runs out of time or the person leaves the app. The native
 * request is left to finish; its answer is dropped.
 */
function race<T>(work: Promise<T>, ms: number, left: Promise<void>): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    const settle = (value: T | null) => {
      clearTimeout(timer);
      resolve(value);
    };
    work.then(settle, () => settle(null));
    void left.then(() => settle(null));
  });
}

/** A reading the backend would only answer 422 to is not worth sending. */
function fixOf(reading: Reading, end: LocationEnd): LocationFix | null {
  const { latitude, longitude, accuracy } = reading;
  if (accuracy === null || ![latitude, longitude, accuracy].every(Number.isFinite)) return null;
  if (accuracy <= 0) return null;
  return { end, latitude, longitude, accuracy };
}

const quietly = <T>(work: () => Promise<T>, fallback: T): Promise<T> =>
  work().catch(() => fallback);

/**
 * The web's two passes after one clock, coarse then precise, each fix sent as it arrives. The
 * backend keeps whichever is sharper. Nothing here throws: a refusal, no fix, a timeout and a
 * dropped request all end with the events saying nothing was saved.
 *
 * Leaving the app ends it. iOS suspends the app about five seconds later, and a fix read after the
 * person comes back says where they are then, not where they clocked.
 */
export async function captureLocation({
  end,
  device,
  send,
  onEvent,
  onLeave,
}: {
  end: LocationEnd;
  device: LocationDevice;
  /** Resolves to the accuracy the backend now holds for that end, or null when it holds none. */
  send: (fix: LocationFix) => Promise<number | null>;
  onEvent: (event: LocationEvent) => void;
  onLeave: (listener: () => void) => () => void;
}): Promise<void> {
  let hasLeft = false;
  let unsubscribe = () => {};
  const left = new Promise<void>((resolve) => {
    unsubscribe = onLeave(() => {
      hasLeft = true;
      resolve();
    });
  });

  try {
    if (!(await quietly(device.servicesEnabled, false))) return;
    const permission = await quietly(device.requestPermission, { granted: false, reduced: false });
    if (!permission.granted || hasLeft) return;
    onEvent({ kind: "finding", end });

    for (const { pass, timeoutMs, read } of PASSES) {
      const reading = await race(read(device), timeoutMs, left);
      if (hasLeft) return;
      const fix = reading && fixOf(reading, end);
      if (!fix) continue;
      const stored = await quietly(() => send(fix), null);
      if (stored === null) continue;
      onEvent({ kind: "saved", end, pass, accuracy: stored, reduced: permission.reduced });
      // With Precise off iOS ignores the accuracy asked for, so a second pass reads the same.
      if (permission.reduced) return;
    }
  } finally {
    unsubscribe();
    onEvent({ kind: "done", end });
  }
}

export type LocationStatus =
  | { kind: "hidden" }
  | { kind: "finding" }
  | { kind: "sharpening"; accuracy: number }
  | { kind: "saved"; end: LocationEnd; accuracy: number }
  | { kind: "approximate" };

export const HIDDEN: LocationStatus = { kind: "hidden" };

export function nextLocationStatus(status: LocationStatus, event: LocationEvent): LocationStatus {
  switch (event.kind) {
    case "finding":
      return { kind: "finding" };
    case "saved":
      if (event.reduced) return { kind: "approximate" };
      return event.pass === "coarse"
        ? { kind: "sharpening", accuracy: event.accuracy }
        : { kind: "saved", end: event.end, accuracy: event.accuracy };
    case "done":
      if (status.kind === "finding") return HIDDEN;
      if (status.kind === "sharpening") {
        return { kind: "saved", end: event.end, accuracy: status.accuracy };
      }
      return status;
  }
}

/**
 * The one-time notice waits for `/me/settings`, so it never flashes for someone who dismissed it.
 * A locked clock shows its lock notice alone, as on the web.
 */
export function locationNoticeShown(
  state: AttendanceState | null,
  settings: { attendanceLocationNoticeDismissed: boolean } | undefined
): boolean {
  if (!state?.locationEnabled || clockStatusOf(state) === "inactive") return false;
  return settings !== undefined && !settings.attendanceLocationNoticeDismissed;
}

/** A non-breaking space: "±9" wrapping away from its "m" reads as nothing at all. */
export function formatRadius(metres: number, locale: string): string {
  const rounded = Math.round(metres);
  if (rounded < 1_000) return `${rounded}\u00a0m`;
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metres / 1_000);
  return `${km}\u00a0km`;
}
