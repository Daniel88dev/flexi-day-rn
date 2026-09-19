import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PENDING_CHANGES_CHANNEL } from "../events";
import {
  activePendingChanges,
  expectedVacationPatch,
  type PendingChanges,
  type VacationDraft,
} from "../pending";
import { mergedVacations } from "../queries";
import type { StoreRuntime } from "../runtime";
import { createFakeClock, type FakeClock } from "../test-support/fake-clock";
import { flushStoreEvents, openTestStore } from "../test-support/test-store";

const NOW = "2026-09-19T12:00:00.000Z";

const DRAFT: VacationDraft = { groupId: "group-1", from: "2026-09-21", to: "2026-09-25" };

let clock: FakeClock;
let store: StoreRuntime;
let pending: PendingChanges;

beforeEach(async () => {
  clock = createFakeClock(NOW);
  store = await openTestStore("user-1", { clock });
  pending = activePendingChanges();
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function announcements(): string[][] {
  const seen: string[][] = [];
  store.events.subscribe([PENDING_CHANGES_CHANNEL], (channels) => seen.push([...channels]));
  return seen;
}

describe("createPendingChanges", () => {
  it("returns the change it added, stamped with the clock it was built with", () => {
    const change = pending.add({ kind: "create", draft: DRAFT });

    expect(change).toEqual({
      id: expect.any(String),
      kind: "create",
      draft: DRAFT,
      startedAt: Date.parse(NOW),
    });
    expect(pending.list()).toEqual([change]);
  });

  it("returns an id of its own for every change, so two creates never collide", () => {
    const first = pending.add({ kind: "create", draft: DRAFT });
    const second = pending.add({ kind: "create", draft: DRAFT });

    expect(second.id).not.toBe(first.id);
    expect(pending.list()).toEqual([first, second]);
  });

  it("returns the changes still in flight after one is removed", () => {
    const first = pending.add({ kind: "create", draft: DRAFT });
    const second = pending.add({ kind: "approve", vacationIds: ["vacation-1"] });

    pending.remove(first.id);

    expect(pending.list()).toEqual([second]);
  });

  it("returns a list that keeps its identity until a change moves", () => {
    const list = pending.list();

    expect(pending.list()).toBe(list);

    const change = pending.add({ kind: "create", draft: DRAFT });
    expect(pending.list()).not.toBe(list);

    const added = pending.list();
    pending.remove(`${change.id}-other`);
    expect(pending.list()).toBe(added);
  });

  it("announces the overlay's channel when a change is added", async () => {
    const seen = announcements();

    pending.add({ kind: "create", draft: DRAFT });
    await flushStoreEvents();

    expect(seen).toEqual([[PENDING_CHANGES_CHANNEL]]);
  });

  it("announces the overlay's channel when a change is removed", async () => {
    const change = pending.add({ kind: "create", draft: DRAFT });
    await flushStoreEvents();
    const seen = announcements();

    pending.remove(change.id);
    await flushStoreEvents();

    expect(seen).toEqual([[PENDING_CHANGES_CHANNEL]]);
  });

  it("announces nothing when the id it is asked to remove is not in flight", async () => {
    const seen = announcements();

    pending.remove("pending-404");
    await flushStoreEvents();

    expect(seen).toEqual([]);
  });

  it("writes nothing to SQLite, so reopening the file shows no trace of a change", async () => {
    const filePath = join(mkdtempSync(join(tmpdir(), "flexi-day-store-")), "store.db");
    await store.lifecycle.closeStore();
    store = await openTestStore("user-1", { filePath, clock });
    activePendingChanges().add({ kind: "create", draft: DRAFT });

    await store.lifecycle.closeStore();
    store = await openTestStore("user-1", { filePath, clock });

    expect(mergedVacations(store.getDatabase(), activePendingChanges().list())).toEqual([]);
    expect(activePendingChanges().list()).toEqual([]);
  });
});

describe("expectedVacationPatch", () => {
  function patchOf(change: Parameters<typeof pending.add>[0]) {
    return expectedVacationPatch(pending.add(change), "user-1");
  }

  it("returns the fields an update named, a null among them clearing the column", () => {
    expect(
      patchOf({
        kind: "update",
        vacationIds: ["vacation-1"],
        update: { vacationType: "HOME_OFFICE", note: null },
      })
    ).toEqual({ vacationType: "HOME_OFFICE", note: null });
  });

  it("returns nothing for a field the update left out", () => {
    expect(
      patchOf({ kind: "update", vacationIds: ["vacation-1"], update: { halfDay: true } })
    ).toEqual({ halfDay: true });
  });

  it("returns the approval stamped with the change's own time and the signed-in user", () => {
    expect(patchOf({ kind: "approve", vacationIds: ["vacation-1"] })).toEqual({
      approvedAt: NOW,
      approvedBy: "user-1",
    });
  });

  it("returns the rejection with the reason it was given", () => {
    expect(
      patchOf({ kind: "reject", vacationIds: ["vacation-1"], reason: "Too many away" })
    ).toEqual({ rejectedAt: NOW, rejectedBy: "user-1", rejectionReason: "Too many away" });
  });

  it("returns a rejection with no reason where none was given", () => {
    expect(patchOf({ kind: "reject", vacationIds: ["vacation-1"] })).toEqual({
      rejectedAt: NOW,
      rejectedBy: "user-1",
      rejectionReason: null,
    });
  });

  it("returns the cancellation stamped with the signed-in user", () => {
    expect(patchOf({ kind: "cancel", vacationIds: ["vacation-1"] })).toEqual({
      deletedAt: NOW,
      deletedByUserId: "user-1",
    });
  });

  it("returns nothing for a create, which expands into rows of its own", () => {
    expect(patchOf({ kind: "create", draft: DRAFT })).toEqual({});
  });
});
