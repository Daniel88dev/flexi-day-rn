import { act, renderHook } from "@testing-library/react-native";

import { installPullController, type PullController, type PullOutcome } from "../pull";
import type { StoreRuntime } from "../runtime";
import { createFakeClock, type FakeClock } from "../test-support/fake-clock";
import { createFakeSync, reply, type FakeSyncReply } from "../test-support/fake-sync";
import { pullOptions, tick } from "../test-support/pull-harness";
import { syncPage } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { useSyncStatus } from "../use-sync-status";

const NOW = "2026-09-19T12:00:00.000Z";

let store: StoreRuntime;
let clock: FakeClock;

beforeEach(async () => {
  store = await openTestStore();
  clock = createFakeClock(NOW);
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function install(replies: FakeSyncReply[]): PullController {
  return installPullController(
    pullOptions({ runtime: store, clock, sync: createFakeSync(replies) })
  );
}

describe("useSyncStatus", () => {
  it("returns an idle status before anything pulls", async () => {
    install([]);

    const { result } = await renderHook(() => useSyncStatus());

    expect(result.current).toEqual({
      inFlight: false,
      lastPulledAt: null,
      lastError: null,
      hasCursor: false,
      generation: 0,
    });
  });

  it("returns inFlight while the loop runs and drops it when the loop ends", async () => {
    const controller = install([reply.hang()]);
    const { result } = await renderHook(() => useSyncStatus());

    let pulling: Promise<PullOutcome> | undefined;
    await act(async () => {
      pulling = controller.pull("foreground");
      await tick();
    });
    expect(result.current.inFlight).toBe(true);

    await act(async () => {
      clock.advance(30_000);
      await pulling;
    });

    expect(result.current.inFlight).toBe(false);
    expect(result.current.lastError).toMatch(/timed out/i);
  });

  it("returns the time and generation of a pull that succeeded", async () => {
    const controller = install([
      reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-1" })),
    ]);
    const { result } = await renderHook(() => useSyncStatus());

    await act(async () => {
      await controller.pull("foreground");
    });

    expect(result.current).toEqual({
      inFlight: false,
      lastPulledAt: NOW,
      lastError: null,
      hasCursor: true,
      generation: 1,
    });
  });

  it("returns the error of a pull that failed", async () => {
    const controller = install([reply.status(500)]);
    const { result } = await renderHook(() => useSyncStatus());

    await act(async () => {
      await controller.pull("foreground");
    });

    expect(result.current.lastError).toContain("500");
    expect(result.current.lastPulledAt).toBeNull();
  });
});
