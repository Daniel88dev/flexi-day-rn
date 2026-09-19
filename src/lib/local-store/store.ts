import type { StoreAdapter } from "./adapter";
import type { AppStateSource } from "./app-state";
import type { StoreClock } from "./clock";
import { installPullController, type PullOutcome, type PullReason, type SyncFetch } from "./pull";
import { installStoreRuntime, type StoreRuntime } from "./runtime";
import { createPullTriggers } from "./triggers";

export type StoreOptions = {
  adapter: StoreAdapter;
  fetchPage: SyncFetch;
  clock: StoreClock;
  isOnline: () => Promise<boolean>;
  appState: AppStateSource;
};

export type OpenStoreOptions = {
  /** What a 401 from the sync pull means: the signed-out wipe, once the native session lands. */
  onUnauthorized?: () => void;
};

export type Store = {
  runtime: StoreRuntime;
  openStore(userId: string, options?: OpenStoreOptions): Promise<void>;
  destroyStore(): Promise<void>;
  pull(reason: PullReason): Promise<PullOutcome>;
};

/**
 * The module's one wiring: the runtime, the pull loop and the unauthorized handoff, over the
 * adapter and the fetch they were built with. The device builds one; a test builds its own.
 */
export function createStore({
  adapter,
  fetchPage,
  clock,
  isOnline,
  appState,
}: StoreOptions): Store {
  const runtime = installStoreRuntime(adapter);
  let unwatchAppState: (() => void) | null = null;

  const destroyStore = async () => {
    unwatchAppState?.();
    unwatchAppState = null;
    await runtime.lifecycle.destroyStore();
  };

  const wipeOnUnauthorized = () => {
    console.warn("The sync pull was not authorized; destroying the local store.");
    void destroyStore();
  };

  let onUnauthorized = wipeOnUnauthorized;
  const controller = installPullController({
    runtime,
    fetchPage,
    clock,
    isOnline,
    onUnauthorized: () => onUnauthorized(),
  });
  const triggers = createPullTriggers({ runtime, controller, clock, appState });

  return {
    runtime,
    destroyStore,

    async openStore(userId, options = {}) {
      onUnauthorized = options.onUnauthorized ?? wipeOnUnauthorized;
      await runtime.lifecycle.openStore(userId);
      unwatchAppState ??= triggers.watchAppState();
      // Cold start and sign-in both land here, and both pull whatever the debounce says.
      void triggers.pullOnOpen();
    },

    pull: (reason) => triggers.pull(reason),
  };
}
