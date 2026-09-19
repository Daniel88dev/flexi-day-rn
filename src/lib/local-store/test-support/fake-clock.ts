import type { StoreClock } from "../clock";

export type FakeClock = StoreClock & {
  /** Moves the clock on and runs every timer that falls due, in the order they were set. */
  advance(ms: number): void;
};

type PendingTimer = { at: number; run: () => void; cancelled: boolean };

export function createFakeClock(start = "2026-09-19T12:00:00.000Z"): FakeClock {
  let now = new Date(start).getTime();
  const timers: PendingTimer[] = [];

  return {
    now: () => now,

    setTimeout(run, ms) {
      const timer: PendingTimer = { at: now + ms, run, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },

    advance(ms) {
      now += ms;
      for (const timer of [...timers]) {
        if (timer.cancelled || timer.at > now) continue;
        timer.cancelled = true;
        timer.run();
      }
    },
  };
}
