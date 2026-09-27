import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import { activePendingChanges } from "../pending";
import {
  requestListVacations,
  requestScopeGroups,
  storedRequest,
  type RequestListQuery,
} from "../requests";
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
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function pullIn(page: Partial<SyncEnvelope>) {
  store.write((transaction) => applyPage(transaction, syncPage(page), 1));
}

const NO_ACCESS = { viewAccess: false, adminAccess: false, approverAccess: false };

describe("requestScopeGroups", () => {
  it("returns a group the viewer holds view access in", () => {
    pullIn({
      groups: [groupRow({ id: "g-view", groupName: "Engineering", managerUserId: "boss" })],
      groupUsers: [groupUserRow({ groupId: "g-view", userId: VIEWER, viewAccess: true })],
    });

    expect(requestScopeGroups(store.getDatabase())).toEqual([
      { groupId: "g-view", groupName: "Engineering" },
    ]);
  });

  it("returns a group the viewer administers", () => {
    pullIn({
      groups: [groupRow({ id: "g-admin", managerUserId: "boss" })],
      groupUsers: [
        groupUserRow({ groupId: "g-admin", userId: VIEWER, ...NO_ACCESS, adminAccess: true }),
      ],
    });

    expect(requestScopeGroups(store.getDatabase()).map((g) => g.groupId)).toEqual(["g-admin"]);
  });

  it("returns a group the viewer manages from a plain membership", () => {
    pullIn({
      groups: [groupRow({ id: "g-managed", managerUserId: VIEWER })],
      groupUsers: [groupUserRow({ groupId: "g-managed", userId: VIEWER, ...NO_ACCESS })],
    });

    expect(requestScopeGroups(store.getDatabase()).map((g) => g.groupId)).toEqual(["g-managed"]);
  });

  it("returns nothing for a plain membership, which only reports on the viewer", () => {
    pullIn({
      groups: [groupRow({ id: "g-self", managerUserId: "boss" })],
      groupUsers: [groupUserRow({ groupId: "g-self", userId: VIEWER, ...NO_ACCESS })],
    });

    expect(requestScopeGroups(store.getDatabase())).toEqual([]);
  });

  it("returns nothing for access someone else holds", () => {
    pullIn({
      groups: [groupRow({ id: "g-other", managerUserId: "boss" })],
      groupUsers: [
        groupUserRow({ id: "gu-mine", groupId: "g-other", userId: VIEWER, ...NO_ACCESS }),
        groupUserRow({ id: "gu-theirs", groupId: "g-other", userId: "user-2", viewAccess: true }),
      ],
    });

    expect(requestScopeGroups(store.getDatabase())).toEqual([]);
  });

  it("returns nothing for a group the viewer manages without belonging to it", () => {
    pullIn({ groups: [groupRow({ id: "g-orphan", managerUserId: VIEWER })] });

    expect(requestScopeGroups(store.getDatabase())).toEqual([]);
  });

  it("returns the groups ordered by name", () => {
    pullIn({
      groups: [
        groupRow({ id: "g-z", groupName: "Support" }),
        groupRow({ id: "g-a", groupName: "Design" }),
      ],
      groupUsers: [
        groupUserRow({ id: "gu-z", groupId: "g-z", userId: VIEWER }),
        groupUserRow({ id: "gu-a", groupId: "g-a", userId: VIEWER }),
      ],
    });

    expect(requestScopeGroups(store.getDatabase()).map((g) => g.groupName)).toEqual([
      "Design",
      "Support",
    ]);
  });
});

describe("requestListVacations", () => {
  const SEPTEMBER = { year: 2026, month: 9 };
  const GROUP_1 = { month: SEPTEMBER, scope: { kind: "group", groupId: "group-1" } } as const;
  const MINE = { month: SEPTEMBER, scope: { kind: "mine" } } as const;

  function listed(query: RequestListQuery) {
    return requestListVacations(store.getDatabase(), activePendingChanges().list(), query);
  }

  function idsOf(query: RequestListQuery) {
    return listed(query).map((row) => row.id);
  }

  beforeEach(() => {
    pullIn({
      users: [userRow({ id: VIEWER, name: "Dana" }), userRow({ id: "user-2", name: "Eva" })],
      groups: [
        groupRow({ id: "group-1", groupName: "Engineering" }),
        groupRow({ id: "group-2", groupName: "Support" }),
      ],
      groupUsers: [
        groupUserRow({ id: "gu-1", groupId: "group-1", userId: VIEWER }),
        groupUserRow({ id: "gu-2", groupId: "group-1", userId: "user-2" }),
      ],
    });
  });

  it("returns the month's rows and none from the months beside it", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "aug-31", requestedDay: "2026-08-31" }),
        vacationRow({ id: "sep-1", requestedDay: "2026-09-01" }),
        vacationRow({ id: "sep-30", requestedDay: "2026-09-30" }),
        vacationRow({ id: "oct-1", requestedDay: "2026-10-01" }),
      ],
    });

    expect(idsOf(GROUP_1)).toEqual(["sep-1", "sep-30"]);
  });

  it("returns every member's rows of the group in scope and no other group's", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "mine", userId: VIEWER }),
        vacationRow({ id: "eva", userId: "user-2" }),
        vacationRow({ id: "support", userId: "user-2", groupId: "group-2" }),
      ],
    });

    expect(idsOf(GROUP_1)).toEqual(["eva", "mine"]);
  });

  it("returns a row mirrored into the group in scope from a member's other group", () => {
    pullIn({
      groupMirrors: [
        groupMirrorRow({ userId: "user-2", sourceGroupId: "group-2", targetGroupId: "group-1" }),
      ],
      vacations: [vacationRow({ id: "mirrored", userId: "user-2", groupId: "group-2" })],
    });

    expect(listed(GROUP_1)).toEqual([
      expect.objectContaining({ id: "mirrored", groupName: "Support" }),
    ]);
  });

  it("returns no mirrored row for someone who no longer belongs to the group in scope", () => {
    pullIn({
      groupMirrors: [
        groupMirrorRow({ userId: "user-3", sourceGroupId: "group-2", targetGroupId: "group-1" }),
      ],
      vacations: [vacationRow({ id: "left", userId: "user-3", groupId: "group-2" })],
    });

    expect(idsOf(GROUP_1)).toEqual([]);
  });

  it("returns only the viewer's own rows, from every group, with no group in scope", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "mine-1", userId: VIEWER, groupId: "group-1" }),
        vacationRow({ id: "mine-2", userId: VIEWER, groupId: "group-2" }),
        vacationRow({ id: "eva", userId: "user-2" }),
      ],
    });

    expect(idsOf(MINE)).toEqual(["mine-1", "mine-2"]);
  });

  it("returns cancelled rows too", () => {
    pullIn({ vacations: [vacationRow({ id: "cancelled", deletedAt: "2026-09-02T08:00:00Z" })] });

    expect(listed(GROUP_1)).toEqual([
      expect.objectContaining({ id: "cancelled", status: "cancelled" }),
    ]);
  });

  it("returns each row with its person's and its group's name", () => {
    pullIn({ vacations: [vacationRow({ id: "eva", userId: "user-2" })] });

    expect(listed(GROUP_1)).toEqual([
      expect.objectContaining({ userName: "Eva", groupName: "Engineering" }),
    ]);
  });

  it("returns no name for a person the store holds no row for", () => {
    pullIn({ vacations: [vacationRow({ id: "stranger", userId: "user-9" })] });

    expect(listed(GROUP_1)[0].userName).toBeNull();
  });

  it("returns the rows a create in flight expects inside the month, as pending", () => {
    activePendingChanges().add({
      kind: "create",
      draft: { groupId: "group-1", from: "2026-09-30", to: "2026-10-01" },
    });

    expect(listed(MINE)).toEqual([
      expect.objectContaining({ requestedDay: "2026-09-30", pending: true, userName: "Dana" }),
    ]);
  });
});

describe("storedRequest", () => {
  beforeEach(() => {
    pullIn({
      groups: [groupRow()],
      users: [userRow({ id: "user-2", name: "Eva Horáková" })],
      vacations: [
        vacationRow({ id: "eva-1", userId: "user-2", requestedDay: "2026-09-21", note: "Trip" }),
        vacationRow({ id: "eva-2", userId: "user-2", requestedDay: "2026-09-22" }),
        vacationRow({ id: "eva-3", userId: "user-2", requestedDay: "2026-09-23" }),
        vacationRow({
          id: "eva-sick",
          userId: "user-2",
          requestedDay: "2026-09-24",
          vacationType: "SICK",
        }),
      ],
    });
  });

  it("returns the run the day belongs to, with its person, group and note", () => {
    expect(storedRequest(store.getDatabase(), [], "eva-2")).toEqual(
      expect.objectContaining({
        userName: "Eva Horáková",
        groupName: "Engineering",
        from: "2026-09-21",
        to: "2026-09-23",
        vacationIds: ["eva-1", "eva-2", "eva-3"],
        note: null,
        status: "pending",
      })
    );
  });

  it("returns the run as a change in flight holds it", () => {
    const overlay = [
      { id: "p", kind: "approve" as const, vacationIds: ["eva-1", "eva-2", "eva-3"], startedAt: 0 },
    ];

    expect(storedRequest(store.getDatabase(), overlay, "eva-1")).toEqual(
      expect.objectContaining({ status: "approved", pending: true, note: "Trip" })
    );
  });

  it("returns null for a day the store does not hold", () => {
    expect(storedRequest(store.getDatabase(), [], "gone")).toBeNull();
  });
});
