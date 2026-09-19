import { applyPage, sweepGenerations, writeSyncState } from "../apply";
import type { StoreRuntime } from "../runtime";
import { organizations } from "../schema";
import { fullSyncPage, groupUserRow, syncPage, vacationRow } from "../test-support/sync-fixtures";
import { flushStoreEvents, openTestStore } from "../test-support/test-store";

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore();
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function subscribeToEverything() {
  const listener = jest.fn();
  store.events.subscribe(
    [
      "organizations",
      "users",
      "groups",
      "groupUsers",
      "groupMirrors",
      "userYearQuotas",
      "bankHolidays",
      "vacations",
      "syncState",
    ],
    listener
  );
  return listener;
}

describe("write", () => {
  it("emits exactly the tables the committed transaction touched", async () => {
    const listener = subscribeToEverything();

    store.write((transaction) => {
      applyPage(transaction, syncPage({ vacations: [vacationRow()] }), 1);
      writeSyncState(transaction, { cursor: "next" });
    });
    await flushStoreEvents();

    expect(listener).toHaveBeenCalledTimes(1);
    expect([...listener.mock.calls[0][0]].sort()).toEqual(["syncState", "vacations"]);
  });

  it("emits once for several transactions landing in the same tick", async () => {
    const listener = subscribeToEverything();

    store.write((transaction) =>
      applyPage(transaction, syncPage({ vacations: [vacationRow()] }), 1)
    );
    store.write((transaction) =>
      applyPage(transaction, syncPage({ organizations: [{ id: "org-2", name: "Contoso" }] }), 1)
    );
    store.write((transaction) => writeSyncState(transaction, { cursor: "next" }));
    await flushStoreEvents();

    expect(listener).toHaveBeenCalledTimes(1);
    expect([...listener.mock.calls[0][0]].sort()).toEqual([
      "organizations",
      "syncState",
      "vacations",
    ]);
  });

  it("emits nothing for a transaction that wrote no table", async () => {
    const listener = subscribeToEverything();

    store.write((transaction) => applyPage(transaction, syncPage(), 1));
    await flushStoreEvents();

    expect(listener).not.toHaveBeenCalled();
  });

  it("emits nothing when the sweep deletes nothing", async () => {
    store.write((transaction) => applyPage(transaction, fullSyncPage(), 2));
    await flushStoreEvents();
    const listener = subscribeToEverything();

    store.write((transaction) => sweepGenerations(transaction, 2));
    await flushStoreEvents();

    expect(listener).not.toHaveBeenCalled();
  });

  it("emits nothing for a tombstone that matches no local row", async () => {
    const listener = subscribeToEverything();

    store.write((transaction) =>
      applyPage(
        transaction,
        syncPage({
          groupUsers: [groupUserRow({ id: "gone", deletedAt: "2026-09-20T08:00:00.000Z" })],
        }),
        1
      )
    );
    await flushStoreEvents();

    expect(listener).not.toHaveBeenCalled();
  });

  it("emits nothing when the transaction throws", async () => {
    const listener = subscribeToEverything();

    expect(() =>
      store.write((transaction) => {
        applyPage(transaction, fullSyncPage(), 1);
        throw new Error("page failed");
      })
    ).toThrow("page failed");
    await flushStoreEvents();

    expect(listener).not.toHaveBeenCalled();
    expect(store.getDatabase().select().from(organizations).all()).toEqual([]);
  });

  it("returns what the transaction returned", () => {
    const applied = store.write(() => "done");

    expect(applied).toBe("done");
  });
});
