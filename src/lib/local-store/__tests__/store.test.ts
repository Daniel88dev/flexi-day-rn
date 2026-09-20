import { readSyncState } from "../apply";
import { activePullController } from "../pull";
import { createStore, type Store } from "../store";
import { createBetterSqlite3Adapter } from "../test-support/better-sqlite3-adapter";
import { createFakeAppState, type FakeAppState } from "@/test-support/fake-app-state";
import { createFakeClock, type FakeClock } from "@/test-support/fake-clock";
import {
  createFakeSync,
  reply,
  type FakeSync,
  type FakeSyncReply,
} from "../test-support/fake-sync";
import { tick } from "../test-support/pull-harness";
import { syncPage } from "../test-support/sync-fixtures";

const NOW = "2026-09-19T12:00:00.000Z";

let clock: FakeClock;
let sync: FakeSync;
let appState: FakeAppState;
let warn: jest.SpyInstance;

beforeEach(() => {
  clock = createFakeClock(NOW);
  appState = createFakeAppState();
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

function buildStore(replies: FakeSyncReply[]): Store {
  sync = createFakeSync(replies);
  return createStore({
    adapter: createBetterSqlite3Adapter(":memory:"),
    apiFetch: sync.apiFetch,
    clock,
    isOnline: () => Promise.resolve(true),
    appState,
  });
}

describe("createStore", () => {
  it("pulls once when the store opens", async () => {
    const store = buildStore([
      reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-1" })),
    ]);

    await store.openStore("user-1");
    await tick();

    expect(sync.cursors).toEqual([null]);
    expect(readSyncState(store.runtime.getDatabase())).toMatchObject({
      cursor: "page-1",
      lastPulledAt: NOW,
    });
  });

  it("hands an unauthorized request to the callback the caller opened the store with", async () => {
    const store = buildStore([reply.status(401)]);
    const onUnauthorized = jest.fn();

    await store.openStore("user-1", { onUnauthorized });
    await tick();
    store.handleUnauthorized();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    // A 401 the pull saw is no error to record; the wrapper is what answers it.
    expect(activePullController().status().lastError).toBeNull();
    expect(store.runtime.isOpen()).toBe(true);
  });

  it("destroys the store on an unauthorized request when the caller passed no callback", async () => {
    const store = buildStore([reply.status(401)]);

    await store.openStore("user-1");
    await tick();
    store.handleUnauthorized();
    await tick();

    expect(store.runtime.isOpen()).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("pulls when the app comes back to the foreground, debounce permitting", async () => {
    const store = buildStore([
      reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-1" })),
      reply.page(syncPage({ hasMore: false, cursor: "page-2" })),
    ]);

    await store.openStore("user-1");
    await tick();

    appState.becomeActive();
    await tick();
    expect(sync.cursors).toEqual([null]);

    clock.advance(30_000);
    appState.becomeActive();
    await tick();

    expect(sync.cursors).toEqual([null, "page-1"]);
  });

  it("stops listening for the foreground when the store is destroyed", async () => {
    const store = buildStore([
      reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-1" })),
    ]);

    await store.openStore("user-1");
    await tick();
    expect(appState.listening()).toBe(true);

    await store.destroyStore();

    expect(appState.listening()).toBe(false);
  });

  it("pulls on demand after the store is open", async () => {
    const store = buildStore([
      reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-1" })),
      reply.page(syncPage({ hasMore: false, cursor: "page-2" })),
    ]);

    await store.openStore("user-1");
    await tick();
    await store.pull("after-write");

    expect(sync.cursors).toEqual([null, "page-1"]);
    expect(readSyncState(store.runtime.getDatabase())?.cursor).toBe("page-2");
  });
});
