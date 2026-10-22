import { applyPage } from "../apply";
import { myAwaitingRequests } from "../awaiting-requests";
import type { SyncEnvelope } from "../envelope";
import { activePendingChanges } from "../pending";
import type { StoreRuntime } from "../runtime";
import {
  groupMirrorRow,
  groupRow,
  groupUserRow,
  syncPage,
  userRow,
  vacationRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

const VIEWER = "user-1";

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore(VIEWER);
  pullIn({
    users: [userRow({ id: VIEWER, name: "Dana" }), userRow({ id: "user-2", name: "Eva" })],
    groups: [
      groupRow({ id: "group-1", groupName: "Engineering", managerUserId: "boss" }),
      groupRow({ id: "group-2", groupName: "Support", managerUserId: "boss" }),
    ],
    groupUsers: [
      groupUserRow({ id: "gu-1", groupId: "group-1", userId: VIEWER }),
      groupUserRow({ id: "gu-2", groupId: "group-2", userId: VIEWER }),
    ],
  });
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function pullIn(page: Partial<SyncEnvelope>) {
  store.write((transaction) => applyPage(transaction, syncPage(page), 1));
}

const awaiting = () => myAwaitingRequests(store.getDatabase(), activePendingChanges().list());

describe("myAwaitingRequests", () => {
  it("returns the viewer's own rows awaiting approval, one per Request", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "mon", requestedDay: "2026-09-21" }),
        vacationRow({ id: "tue", requestedDay: "2026-09-22" }),
        vacationRow({ id: "thu", requestedDay: "2026-09-24", requestId: "request-2" }),
      ],
    });

    expect(awaiting()).toEqual([
      expect.objectContaining({
        groupName: "Engineering",
        vacationType: "VACATION",
        from: "2026-09-21",
        to: "2026-09-22",
        vacationIds: ["mon", "tue"],
        pending: false,
      }),
      expect.objectContaining({ from: "2026-09-24", to: "2026-09-24", vacationIds: ["thu"] }),
    ]);
  });

  it("returns one range for a Request across a weekend", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "fri", requestedDay: "2026-09-25" }),
        vacationRow({ id: "mon", requestedDay: "2026-09-28" }),
      ],
    });

    expect(awaiting()).toEqual([
      expect.objectContaining({ from: "2026-09-25", to: "2026-09-28", dayCount: 2 }),
    ]);
  });

  it("returns nothing that was decided or cancelled, or that belongs to someone else", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "approved", approvedAt: "2026-09-02T08:00:00Z" }),
        vacationRow({ id: "rejected", rejectedAt: "2026-09-02T08:00:00Z" }),
        vacationRow({ id: "cancelled", deletedAt: "2026-09-02T08:00:00Z" }),
        vacationRow({ id: "eva", userId: "user-2" }),
      ],
    });

    expect(awaiting()).toEqual([]);
  });

  it("returns nothing from a group that is gone", () => {
    pullIn({
      groups: [
        groupRow({ id: "group-2", managerUserId: "boss", deletedAt: "2026-09-01T00:00:00Z" }),
      ],
      vacations: [vacationRow({ id: "gone", groupId: "group-2" })],
    });

    expect(awaiting()).toEqual([]);
  });

  it("returns a booking whose create is still in flight, as a pending change", () => {
    activePendingChanges().add({
      kind: "create",
      draft: { groupId: "group-2", from: "2026-10-05", to: "2026-10-06" },
    });

    expect(awaiting()).toEqual([
      expect.objectContaining({
        groupName: "Support",
        from: "2026-10-05",
        to: "2026-10-06",
        pending: true,
      }),
    ]);
  });

  it("returns nothing for a row a cancel in flight holds", () => {
    pullIn({ vacations: [vacationRow({ id: "mine" })] });
    activePendingChanges().add({ kind: "cancel", vacationIds: ["mine"] });

    expect(awaiting()).toEqual([]);
  });

  it("leaves out a group where the viewer's approver access lets them decide their own", () => {
    pullIn({
      groupUsers: [
        groupUserRow({ id: "gu-1", groupId: "group-1", userId: VIEWER, approverAccess: true }),
      ],
      vacations: [
        vacationRow({ id: "own-decidable", groupId: "group-1" }),
        vacationRow({ id: "support", groupId: "group-2" }),
      ],
    });

    expect(awaiting().map((run) => run.vacationIds)).toEqual([["support"]]);
  });

  it("keeps a group the viewer approves in as its manager, which decides nothing of their own", () => {
    pullIn({
      groups: [groupRow({ id: "group-1", groupName: "Engineering", managerUserId: VIEWER })],
      vacations: [vacationRow({ id: "managed", groupId: "group-1" })],
    });

    expect(awaiting().map((run) => run.vacationIds)).toEqual([["managed"]]);
  });

  it("keeps a group with approver access while the viewer's records are mirrored into it", () => {
    pullIn({
      groupUsers: [
        groupUserRow({ id: "gu-1", groupId: "group-1", userId: VIEWER, approverAccess: true }),
      ],
      groupMirrors: [
        groupMirrorRow({ userId: VIEWER, sourceGroupId: "group-2", targetGroupId: "group-1" }),
      ],
      vacations: [vacationRow({ id: "mirrored-in", groupId: "group-1" })],
    });

    expect(awaiting().map((run) => run.vacationIds)).toEqual([["mirrored-in"]]);
  });

  it("leaves out a group again once the mirror into it has ended", () => {
    pullIn({
      groupUsers: [
        groupUserRow({ id: "gu-1", groupId: "group-1", userId: VIEWER, approverAccess: true }),
      ],
      groupMirrors: [
        groupMirrorRow({
          userId: VIEWER,
          sourceGroupId: "group-2",
          targetGroupId: "group-1",
          deletedAt: "2026-09-01T00:00:00Z",
        }),
      ],
      vacations: [vacationRow({ id: "own-decidable", groupId: "group-1" })],
    });

    expect(awaiting()).toEqual([]);
  });

  it("keeps a group where the viewer's approver access ended with the membership", () => {
    pullIn({
      groupUsers: [
        groupUserRow({
          id: "gu-1",
          groupId: "group-1",
          userId: VIEWER,
          approverAccess: true,
          deletedAt: "2026-09-01T00:00:00Z",
        }),
      ],
      vacations: [vacationRow({ id: "left", groupId: "group-1" })],
    });

    expect(awaiting().map((run) => run.vacationIds)).toEqual([["left"]]);
  });
});
