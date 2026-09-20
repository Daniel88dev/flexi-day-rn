import { count } from "drizzle-orm";

import { applyPage, readSyncState, writeSyncState } from "../apply";
import type { SyncTableName } from "../envelope";
import { createPullController, type PullControllerOptions } from "../pull";
import type { StoreRuntime, StoreTransaction } from "../runtime";
import { schema, type StoreTableName } from "../schema";
import { createFakeClock, type FakeClock } from "@/test-support/fake-clock";
import {
  createFakeSync,
  reply,
  type FakeSync,
  type FakeSyncReply,
} from "../test-support/fake-sync";
import { pullOptions, tick } from "../test-support/pull-harness";
import {
  groupMirrorRow,
  groupRow,
  groupUserRow,
  organizationRow,
  syncPage,
  userRow,
  vacationRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

const NOW = "2026-09-19T12:00:00.000Z";
const TOMBSTONED = "2026-09-19T11:00:00.000Z";

let store: StoreRuntime;
let clock: FakeClock;

beforeEach(async () => {
  store = await openTestStore();
  clock = createFakeClock(NOW);
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function controllerFor(sync: FakeSync, overrides: Partial<PullControllerOptions> = {}) {
  return createPullController(pullOptions({ runtime: store, clock, sync, ...overrides }));
}

function pullWith(replies: FakeSyncReply[], overrides: Partial<PullControllerOptions> = {}) {
  const sync = createFakeSync(replies);
  return { sync, controller: controllerFor(sync, overrides) };
}

function storedSyncState() {
  return readSyncState(store.getDatabase());
}

function rowCount(table: SyncTableName): number {
  return store.getDatabase().select({ rows: count() }).from(schema[table]).all()[0].rows;
}

function seed(page: Parameters<typeof applyPage>[1], generation: number, cursor: string | null) {
  store.write((transaction) => {
    applyPage(transaction, page, generation);
    writeSyncState(transaction, { cursor, generation, lastPulledAt: NOW });
  });
}

/** A runtime that records the tables each transaction touched, so atomicity can be asserted. */
function recordingRuntime(transactions: StoreTableName[][]): StoreRuntime {
  return {
    ...store,
    write(run) {
      const touched: StoreTableName[] = [];
      const result = store.write((transaction: StoreTransaction) =>
        run({
          db: transaction.db,
          touch: (table) => {
            touched.push(table);
            transaction.touch(table);
          },
        })
      );
      transactions.push(touched);
      return result;
    },
  };
}

describe("pull", () => {
  it("applies each page of a snapshot as it lands and stores the cursor after the last one", async () => {
    const duringRequests: { cursor: string | null; organizations: number; stored: unknown }[] = [];
    const sync = createFakeSync(
      [
        reply.page(
          syncPage({
            reset: true,
            hasMore: true,
            cursor: "page-1",
            organizations: [organizationRow()],
            users: [userRow()],
          })
        ),
        reply.page(
          syncPage({ reset: true, hasMore: true, cursor: "page-2", groups: [groupRow()] })
        ),
        reply.page(
          syncPage({ reset: true, hasMore: false, cursor: "page-3", vacations: [vacationRow()] })
        ),
      ],
      {
        onRequest: (cursor) =>
          duringRequests.push({
            cursor,
            organizations: rowCount("organizations"),
            stored: storedSyncState()?.cursor,
          }),
      }
    );

    await controllerFor(sync).pull("foreground");

    expect(sync.cursors).toEqual([null, "page-1", "page-2"]);
    expect(duringRequests.map((request) => request.organizations)).toEqual([0, 1, 1]);
    expect(duringRequests.map((request) => request.stored)).toEqual([null, null, null]);
    expect(storedSyncState()).toMatchObject({ cursor: "page-3", lastPulledAt: NOW, generation: 1 });
    expect(rowCount("groups")).toBe(1);
    expect(rowCount("vacations")).toBe(1);
  });

  it("keeps the rows a snapshot has not re-sent readable until its last page", async () => {
    seed(syncPage({ vacations: [vacationRow(), vacationRow({ id: "vacation-2" })] }), 1, "old");
    const readable: number[] = [];
    const sync = createFakeSync(
      [
        reply.page(
          syncPage({ reset: true, hasMore: true, cursor: "page-1", vacations: [vacationRow()] })
        ),
        reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-2" })),
      ],
      { onRequest: () => readable.push(rowCount("vacations")) }
    );

    await controllerFor(sync).pull("foreground");

    expect(readable).toEqual([2, 2]);
    expect(rowCount("vacations")).toBe(1);
    expect(storedSyncState()).toMatchObject({ cursor: "page-2", generation: 2 });
  });

  it("sweeps and writes the cursor in one transaction", async () => {
    seed(syncPage({ vacations: [vacationRow({ id: "vacation-2" })] }), 1, "old");
    const transactions: StoreTableName[][] = [];
    const sync = createFakeSync([
      reply.page(
        syncPage({ reset: true, hasMore: false, cursor: "page-1", vacations: [vacationRow()] })
      ),
    ]);

    await controllerFor(sync, { runtime: recordingRuntime(transactions) }).pull("foreground");

    expect(transactions.at(-1)).toEqual(["vacations", "vacations", "syncState"]);
  });

  it("stores no cursor when a snapshot fails mid-loop, so the next pull sends none", async () => {
    const { sync, controller } = pullWith([
      reply.page(
        syncPage({
          reset: true,
          hasMore: true,
          cursor: "page-1",
          organizations: [organizationRow()],
        })
      ),
      reply.failure("the connection dropped"),
      reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-9" })),
    ]);

    await controller.pull("foreground");
    expect(storedSyncState()?.cursor).toBeNull();
    expect(controller.status().lastError).toContain("the connection dropped");

    await controller.pull("foreground");

    expect(sync.cursors).toEqual([null, "page-1", null]);
    expect(storedSyncState()).toMatchObject({ cursor: "page-9" });
  });

  it("sweeps the rows an interrupted snapshot left behind on the next one", async () => {
    seed(syncPage({ vacations: [vacationRow({ id: "stale" })] }), 1, null);
    const { controller } = pullWith([
      reply.page(
        syncPage({
          reset: true,
          hasMore: true,
          cursor: "page-1",
          vacations: [vacationRow({ id: "half-way" })],
        })
      ),
      reply.failure("the connection dropped"),
      reply.page(
        syncPage({ reset: true, hasMore: false, cursor: "page-2", vacations: [vacationRow()] })
      ),
    ]);

    await controller.pull("foreground");
    await controller.pull("foreground");

    expect(rowCount("vacations")).toBe(1);
    expect(storedSyncState()).toMatchObject({ cursor: "page-2", generation: 3 });
  });

  it("keeps the cursor when a delta fails", async () => {
    seed(syncPage(), 1, "old");
    const { controller } = pullWith([reply.failure("the connection dropped")]);

    await controller.pull("foreground");

    expect(storedSyncState()?.cursor).toBe("old");
  });

  it("drops the cursor and pulls again when a delta page tombstones a membership row", async () => {
    seed(syncPage({ groupUsers: [groupUserRow({ id: "group-user-2" })] }), 1, "old");
    const { sync, controller } = pullWith([
      reply.page(
        syncPage({
          hasMore: false,
          cursor: "page-1",
          groupUsers: [groupUserRow({ id: "group-user-2", deletedAt: TOMBSTONED })],
        })
      ),
      reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-2" })),
    ]);

    await controller.pull("foreground");

    expect(sync.cursors).toEqual(["old", null]);
    expect(storedSyncState()).toMatchObject({ cursor: "page-2", generation: 2 });
  });

  it("drops the cursor and pulls again when a delta page tombstones a mirror", async () => {
    seed(syncPage(), 1, "old");
    const { sync, controller } = pullWith([
      reply.page(
        syncPage({
          hasMore: false,
          cursor: "page-1",
          groupMirrors: [groupMirrorRow({ deletedAt: TOMBSTONED })],
        })
      ),
      reply.page(syncPage({ reset: true, hasMore: false, cursor: "page-2" })),
    ]);

    await controller.pull("foreground");

    expect(sync.cursors).toEqual(["old", null]);
    expect(storedSyncState()?.cursor).toBe("page-2");
  });

  it("leaves the last pull's time to the snapshot that answers the dropped cursor", async () => {
    seed(syncPage(), 1, "old");
    clock.advance(60_000);
    const { controller } = pullWith([
      reply.page(
        syncPage({
          hasMore: false,
          cursor: "page-1",
          groupUsers: [groupUserRow({ deletedAt: TOMBSTONED })],
        })
      ),
      reply.failure("the connection dropped"),
    ]);

    await controller.pull("foreground");

    expect(storedSyncState()).toMatchObject({ cursor: null, lastPulledAt: NOW });
    expect(controller.status().lastError).toContain("the connection dropped");
  });

  it("stops after the second loop even when that one asks for a reset too", async () => {
    seed(syncPage(), 1, "old");
    const tombstoned = () =>
      reply.page(
        syncPage({
          hasMore: false,
          cursor: "page-1",
          groupMirrors: [groupMirrorRow({ deletedAt: TOMBSTONED })],
        })
      );
    const { sync, controller } = pullWith([tombstoned(), tombstoned()]);

    await controller.pull("foreground");

    expect(sync.cursors).toEqual(["old", null]);
  });

  it("stays in one loop when a snapshot page tombstones a membership row", async () => {
    const { sync, controller } = pullWith([
      reply.page(
        syncPage({
          reset: true,
          hasMore: false,
          cursor: "page-1",
          groupUsers: [groupUserRow({ deletedAt: TOMBSTONED })],
        })
      ),
    ]);

    await controller.pull("foreground");

    expect(sync.cursors).toEqual([null]);
    expect(storedSyncState()?.cursor).toBe("page-1");
  });

  it("stays in one loop when a delta page carries a live membership row", async () => {
    seed(syncPage(), 1, "old");
    const { sync, controller } = pullWith([
      reply.page(syncPage({ hasMore: false, cursor: "page-1", groupUsers: [groupUserRow()] })),
    ]);

    await controller.pull("foreground");

    expect(sync.cursors).toEqual(["old"]);
  });

  it("runs exactly one more loop for the triggers that arrive during one", async () => {
    let triggered = false;
    const sync = createFakeSync(
      [
        reply.page(syncPage({ hasMore: false, cursor: "page-1" })),
        reply.page(syncPage({ hasMore: false, cursor: "page-2" })),
      ],
      {
        onRequest: () => {
          if (triggered) return;
          triggered = true;
          void controller.pull("refresh");
          void controller.pull("after-write");
        },
      }
    );
    const controller = controllerFor(sync);

    await controller.pull("foreground");

    expect(sync.cursors).toEqual([null, "page-1"]);
    expect(controller.status().inFlight).toBe(false);
  });

  it("aborts a page that has not answered within thirty seconds and keeps the cursor", async () => {
    seed(syncPage(), 1, "old");
    const { sync, controller } = pullWith([reply.hang()]);

    const pulling = controller.pull("foreground");
    await tick();
    clock.advance(29_999);
    await tick();
    expect(controller.status().inFlight).toBe(true);

    clock.advance(1);
    await pulling;

    expect(sync.cursors).toEqual(["old"]);
    expect(storedSyncState()).toMatchObject({ cursor: "old", lastPulledAt: NOW });
    expect(controller.status()).toMatchObject({ inFlight: false, lastError: expect.any(String) });
    expect(controller.status().lastError).toMatch(/timed out/i);
  });

  it("skips the request while the device is offline", async () => {
    const { sync, controller } = pullWith([reply.page(syncPage())], {
      isOnline: () => Promise.resolve(false),
    });

    await controller.pull("foreground");

    expect(sync.cursors).toEqual([]);
    expect(controller.status()).toEqual({ inFlight: false, lastError: null });
    expect(storedSyncState()?.lastPulledAt).toBeNull();
  });

  it("returns ok for a rejected session without recording an error", async () => {
    const { controller } = pullWith([reply.status(401)]);

    await expect(controller.pull("foreground")).resolves.toEqual({ ok: true });

    expect(controller.status().lastError).toBeNull();
  });

  it("records the last error for a failure that is neither offline nor unauthorized", async () => {
    const { controller } = pullWith([reply.status(500)]);

    await controller.pull("foreground");

    expect(controller.status().lastError).toContain("500");
  });

  it("clears the last error after a pull that succeeds", async () => {
    const { controller } = pullWith([
      reply.status(500),
      reply.page(syncPage({ hasMore: false, cursor: "page-1" })),
    ]);

    await controller.pull("foreground");
    expect(controller.status().lastError).not.toBeNull();

    await controller.pull("foreground");

    expect(controller.status().lastError).toBeNull();
  });

  it("returns the message of the error envelope a failing page answered with", async () => {
    const { controller } = pullWith([reply.status(503, "Your group was archived.")]);

    expect(await controller.pull("refresh")).toEqual({
      ok: false,
      message: "Your group was archived.",
    });
  });

  it("returns a top-level message for a failure that carried no error envelope", async () => {
    const { controller } = pullWith([reply.statusWithBody(500, { message: "Bad gateway." })]);

    expect(await controller.pull("refresh")).toEqual({ ok: false, message: "Bad gateway." });
  });

  it("returns no message when the failing page described nothing", async () => {
    const { controller } = pullWith([reply.statusWithBody(500, { errors: [] })]);

    expect(await controller.pull("refresh")).toEqual({ ok: false, message: null });
  });

  it("returns no message when the failure was a timeout", async () => {
    const { controller } = pullWith([reply.hang()]);

    const pulling = controller.pull("refresh");
    await tick();
    clock.advance(30_000);

    expect(await pulling).toEqual({ ok: false, message: null });
  });

  it("returns a failure without a message while the device is offline", async () => {
    const { controller } = pullWith([reply.page(syncPage())], {
      isOnline: () => Promise.resolve(false),
    });

    expect(await controller.pull("refresh")).toEqual({ ok: false, message: null });
    expect(controller.status().lastError).toBeNull();
  });

  it("returns ok for a session the server rejected, since the wipe is the feedback", async () => {
    const { controller } = pullWith([reply.status(401)]);

    expect(await controller.pull("refresh")).toEqual({ ok: true });
  });

  it("keeps one flight open across the rerun a trigger queued during it", async () => {
    let settled = false;
    const sync = createFakeSync(
      [reply.page(syncPage({ hasMore: false, cursor: "page-1" })), reply.hang()],
      {
        onRequest: (cursor) => {
          if (cursor === null) void controller.pull("refresh");
        },
      }
    );
    const controller = controllerFor(sync);

    const pulling = controller.pull("refresh").then((outcome) => {
      settled = true;
      return outcome;
    });
    await tick();

    expect(sync.cursors).toEqual([null, "page-1"]);
    expect(settled).toBe(false);
    expect(controller.status().inFlight).toBe(true);

    clock.advance(30_000);
    const outcome = await pulling;

    expect(outcome).toEqual({ ok: false, message: null });
    expect(controller.status().inFlight).toBe(false);
  });

  it("reports inFlight while the loop runs", async () => {
    const inFlight: boolean[] = [];
    const sync = createFakeSync([reply.page(syncPage({ hasMore: false, cursor: "page-1" }))], {
      onRequest: () => inFlight.push(controller.status().inFlight),
    });
    const controller = controllerFor(sync);

    expect(controller.status().inFlight).toBe(false);
    await controller.pull("foreground");

    expect(inFlight).toEqual([true]);
    expect(controller.status().inFlight).toBe(false);
  });
});
