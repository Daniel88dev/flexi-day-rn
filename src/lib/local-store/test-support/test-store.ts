import { installStoreRuntime, type StoreRuntime } from "../runtime";
import { createBetterSqlite3Adapter } from "./better-sqlite3-adapter";

/** An in-memory store, installed as the active runtime so `useStoreQuery` reads it too. */
export async function openTestStore(userId = "user-1"): Promise<StoreRuntime> {
  const runtime = installStoreRuntime(createBetterSqlite3Adapter(":memory:"));
  await runtime.lifecycle.openStore(userId);
  return runtime;
}

/** Lets the event bus's coalescing microtask run. */
export function flushStoreEvents(): Promise<void> {
  return Promise.resolve();
}
