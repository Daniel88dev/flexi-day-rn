import { createPullController, type PullController } from "../pull";
import type { StoreRuntime } from "../runtime";
import { createFakeAppState, type FakeAppState } from "@/test-support/fake-app-state";
import { createFakeClock, type FakeClock } from "@/test-support/fake-clock";
import {
  createFakeSync,
  reply,
  type FakeSync,
  type FakeSyncReply,
} from "../test-support/fake-sync";
import { pullOptions } from "../test-support/pull-harness";
import { syncPage } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { createPullTriggers, FOREGROUND_PULL_DEBOUNCE_MS, type PullTriggers } from "../triggers";

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

function pages(count: number): FakeSyncReply[] {
  return Array.from({ length: count }, (_page, index) =>
    reply.page(syncPage({ hasMore: false, cursor: `page-${index + 1}` }))
  );
}

function triggersFor(replies: FakeSyncReply[]): {
  sync: FakeSync;
  appState: FakeAppState;
  controller: PullController;
  triggers: PullTriggers;
} {
  const sync = createFakeSync(replies);
  const appState = createFakeAppState();
  const controller = createPullController(pullOptions({ runtime: store, clock, sync }));
  return {
    sync,
    appState,
    controller,
    triggers: createPullTriggers({ runtime: store, controller, clock, appState }),
  };
}

describe("createPullTriggers", () => {
  it("returns a skip for a foreground trigger inside the debounce window", async () => {
    const { sync, triggers } = triggersFor(pages(2));
    await triggers.pullOnOpen();

    clock.advance(FOREGROUND_PULL_DEBOUNCE_MS - 1);
    const outcome = await triggers.pull("foreground");

    expect(outcome).toEqual({ ok: true });
    expect(sync.cursors).toEqual([null]);
  });

  it("pulls a foreground trigger once the debounce window has passed", async () => {
    const { sync, triggers } = triggersFor(pages(2));
    await triggers.pullOnOpen();

    clock.advance(FOREGROUND_PULL_DEBOUNCE_MS);
    await triggers.pull("foreground");

    expect(sync.cursors).toEqual([null, "page-1"]);
  });

  it("pulls on open whatever the debounce says, which is cold start and sign-in", async () => {
    const { sync, triggers } = triggersFor(pages(3));
    await triggers.pullOnOpen();

    clock.advance(1_000);
    await triggers.pullOnOpen();
    clock.advance(1_000);
    await triggers.pullOnOpen();

    expect(sync.cursors).toEqual([null, "page-1", "page-2"]);
  });

  it("pulls a refresh and an after-write inside the debounce window", async () => {
    const { sync, triggers } = triggersFor(pages(3));
    await triggers.pullOnOpen();

    clock.advance(1_000);
    await triggers.pull("refresh");
    await triggers.pull("after-write");

    expect(sync.cursors).toEqual([null, "page-1", "page-2"]);
  });

  it("measures the window from the last pull that succeeded", async () => {
    const { sync, triggers } = triggersFor([reply.status(500), ...pages(1)]);

    await triggers.pull("foreground");
    clock.advance(1_000);
    await triggers.pull("foreground");

    expect(sync.cursors).toEqual([null, null]);
  });

  it("pulls when the app becomes active and skips while the window holds", async () => {
    const { sync, appState, triggers } = triggersFor(pages(2));
    triggers.watchAppState();
    await triggers.pullOnOpen();

    clock.advance(1_000);
    appState.becomeActive();
    await Promise.resolve();
    expect(sync.cursors).toEqual([null]);

    clock.advance(FOREGROUND_PULL_DEBOUNCE_MS);
    appState.becomeActive();
    await Promise.resolve();

    expect(sync.cursors).toEqual([null, "page-1"]);
  });

  it("stops pulling on app state once its teardown runs", async () => {
    const { sync, appState, triggers } = triggersFor(pages(1));
    const unwatch = triggers.watchAppState();

    unwatch();
    appState.becomeActive();
    await Promise.resolve();

    expect(appState.listening()).toBe(false);
    expect(sync.cursors).toEqual([]);
  });

  it("returns a skip for every trigger while the store is closed", async () => {
    const { sync, triggers } = triggersFor(pages(1));
    await store.lifecycle.closeStore();

    expect(await triggers.pull("refresh")).toEqual({ ok: true });
    expect(await triggers.pull("foreground")).toEqual({ ok: true });
    expect(sync.cursors).toEqual([]);
  });
});
