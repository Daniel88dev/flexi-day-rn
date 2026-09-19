import type { StoreAdapter } from "./adapter";
import type { StoreClock } from "./clock";
import { installPullController, type PullReason, type SyncFetch } from "./pull";
import { installStoreRuntime, type StoreRuntime } from "./runtime";

export type StoreOptions = {
  adapter: StoreAdapter;
  fetchPage: SyncFetch;
  clock: StoreClock;
  isOnline: () => Promise<boolean>;
};

export type OpenStoreOptions = {
  /** What a 401 from the sync pull means: the signed-out wipe, once the native session lands. */
  onUnauthorized?: () => void;
};

export type Store = {
  runtime: StoreRuntime;
  openStore(userId: string, options?: OpenStoreOptions): Promise<void>;
  destroyStore(): Promise<void>;
  pull(reason: PullReason): Promise<void>;
};

/**
 * The module's one wiring: the runtime, the pull loop and the unauthorized handoff, over the
 * adapter and the fetch they were built with. The device builds one; a test builds its own.
 */
export function createStore({ adapter, fetchPage, clock, isOnline }: StoreOptions): Store {
  const runtime = installStoreRuntime(adapter);

  const destroyStore = () => runtime.lifecycle.destroyStore();

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

  return {
    runtime,
    destroyStore,

    async openStore(userId, options = {}) {
      onUnauthorized = options.onUnauthorized ?? wipeOnUnauthorized;
      await runtime.lifecycle.openStore(userId);
      void controller.pull("foreground");
    },

    pull: (reason) => controller.pull(reason),
  };
}
