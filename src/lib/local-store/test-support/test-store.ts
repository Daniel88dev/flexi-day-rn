import type { StoreClock } from "../clock";
import { systemClock } from "../clock";
import { installPendingChanges } from "../pending";
import { installStoreRuntime, type StoreRuntime } from "../runtime";
import { createBetterSqlite3Adapter } from "./better-sqlite3-adapter";

export type TestStoreOptions = {
  /** A path instead of `:memory:`, for a test that closes the store and opens the file again. */
  filePath?: string;
  clock?: StoreClock;
};

/** An in-memory store installed as the active runtime but not opened, the way a cold start finds it. */
export function installTestStore({
  filePath = ":memory:",
  clock = systemClock,
}: TestStoreOptions = {}): StoreRuntime {
  const runtime = installStoreRuntime(createBetterSqlite3Adapter(filePath));
  installPendingChanges({ runtime, clock });
  return runtime;
}

/** An in-memory store, installed as the active runtime so `useStoreQuery` reads it too. */
export async function openTestStore(
  userId = "user-1",
  options: TestStoreOptions = {}
): Promise<StoreRuntime> {
  const runtime = installTestStore(options);
  await runtime.lifecycle.openStore(userId);
  return runtime;
}

/** Lets the event bus's coalescing microtask run. */
export function flushStoreEvents(): Promise<void> {
  return Promise.resolve();
}
