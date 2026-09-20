import type { StoreClock } from "../clock";
import type { PullControllerOptions } from "../pull";
import type { StoreRuntime } from "../runtime";
import type { FakeSync } from "./fake-sync";

/** Lets every pending promise settle, so a loop reaches its next request. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

type PullOptionsInput = {
  runtime: StoreRuntime;
  clock: StoreClock;
  sync: FakeSync;
} & Partial<Omit<PullControllerOptions, "runtime" | "clock" | "apiFetch">>;

/** A controller's dependencies, online and unwatched unless the test says otherwise. */
export function pullOptions({
  runtime,
  clock,
  sync,
  ...overrides
}: PullOptionsInput): PullControllerOptions {
  return {
    runtime,
    clock,
    apiFetch: sync.apiFetch,
    isOnline: () => Promise.resolve(true),
    ...overrides,
  };
}
