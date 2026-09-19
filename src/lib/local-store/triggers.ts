import { readSyncState } from "./apply";
import type { AppStateSource } from "./app-state";
import type { StoreClock } from "./clock";
import type { PullController, PullOutcome, PullReason } from "./pull";
import type { StoreRuntime } from "./runtime";

export const FOREGROUND_PULL_DEBOUNCE_MS = 30_000;

/** A pull nobody ran is not a failure, so a skip answers the way a success does. */
const SKIPPED: PullOutcome = { ok: true };

export type PullTriggers = {
  pull(reason: PullReason): Promise<PullOutcome>;
  /** Cold start and right after sign-in, which pull whatever the debounce says. */
  pullOnOpen(): Promise<PullOutcome>;
  watchAppState(): () => void;
};

export type PullTriggerOptions = {
  runtime: StoreRuntime;
  controller: PullController;
  clock: StoreClock;
  appState: AppStateSource;
};

/**
 * What turns a trigger into a pull. The debounce is read here rather than in the loop, so the
 * loop stays one shape whoever asked for it and the session's revalidation is never waited on.
 */
export function createPullTriggers({
  runtime,
  controller,
  clock,
  appState,
}: PullTriggerOptions): PullTriggers {
  const pulledRecently = (): boolean => {
    const lastPulledAt = readSyncState(runtime.getDatabase())?.lastPulledAt;
    return (
      lastPulledAt != null && clock.now() - Date.parse(lastPulledAt) < FOREGROUND_PULL_DEBOUNCE_MS
    );
  };

  const triggers: PullTriggers = {
    pull(reason) {
      if (!runtime.isOpen()) return Promise.resolve(SKIPPED);
      if (reason === "foreground" && pulledRecently()) return Promise.resolve(SKIPPED);
      return controller.pull(reason);
    },

    pullOnOpen: () => controller.pull("foreground"),

    watchAppState: () => appState.subscribe(() => void triggers.pull("foreground")),
  };

  return triggers;
}
