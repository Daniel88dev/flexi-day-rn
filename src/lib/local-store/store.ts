import type { StoreAdapter } from "./adapter";
import type { AppStateSource } from "./app-state";
import type { StoreClock } from "./clock";
import type { StoreFetch } from "./fetch";
import { installPendingChanges } from "./pending";
import { installPullController, type PullOutcome, type PullReason } from "./pull";
import { installStoreRuntime, type StoreRuntime } from "./runtime";
import { createPullTriggers } from "./triggers";
import { createStoreWrites, type StoreWrites } from "./writes";

export type StoreOptions = {
  adapter: StoreAdapter;
  apiFetch: StoreFetch;
  clock: StoreClock;
  isOnline: () => Promise<boolean>;
  appState: AppStateSource;
};

export type OpenStoreOptions = {
  /** What an unauthorized request means: the signed-out wipe, once the native session lands. */
  onUnauthorized?: () => void;
};

export type Store = StoreWrites & {
  runtime: StoreRuntime;
  openStore(userId: string, options?: OpenStoreOptions): Promise<void>;
  destroyStore(): Promise<void>;
  /** What the request wrapper calls on a 401: the one place a rejected session is answered. */
  handleUnauthorized(): void;
  pull(reason: PullReason): Promise<PullOutcome>;
};

/**
 * The module's one wiring: the runtime, the pull loop, the pending-change overlay, the writes and
 * the unauthorized handoff, over the adapter and the fetch they were built with. The device
 * builds one; a test builds its own.
 */
export function createStore({ adapter, apiFetch, clock, isOnline, appState }: StoreOptions): Store {
  const runtime = installStoreRuntime(adapter);
  let unwatchAppState: (() => void) | null = null;

  const destroyStore = async () => {
    unwatchAppState?.();
    unwatchAppState = null;
    await runtime.lifecycle.destroyStore();
  };

  const wipeOnUnauthorized = () => {
    console.warn("The request was not authorized; destroying the local store.");
    void destroyStore();
  };

  let onUnauthorized = wipeOnUnauthorized;
  const controller = installPullController({ runtime, apiFetch, clock, isOnline });
  const triggers = createPullTriggers({ runtime, controller, clock, appState });
  const pending = installPendingChanges({ runtime, clock });
  const writes = createStoreWrites({
    runtime,
    apiFetch,
    clock,
    pending,
    pull: (reason) => triggers.pull(reason),
  });

  return {
    ...writes,
    runtime,
    destroyStore,
    handleUnauthorized: () => onUnauthorized(),

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
