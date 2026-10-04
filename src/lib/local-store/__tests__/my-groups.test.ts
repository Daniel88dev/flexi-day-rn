import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import { myGroupsWithRole } from "../my-groups";
import type { StoreRuntime } from "../runtime";
import { groupRow, groupUserRow, organizationRow, syncPage } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

const VIEWER = "user-1";
const DELETED = "2026-09-01T00:00:00.000Z";
const PLAIN = { viewAccess: false, adminAccess: false, approverAccess: false };

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

const myGroups = () => myGroupsWithRole(store.getDatabase());

function membershipIn(groupId: string, flags: Partial<typeof PLAIN> = {}) {
  return groupUserRow({ id: `member-${groupId}`, groupId, userId: VIEWER, ...PLAIN, ...flags });
}

describe("myGroupsWithRole", () => {
  it("returns nothing for an empty store", () => {
    expect(myGroups()).toEqual([]);
  });

  it("returns the group's facts and its organization's name", () => {
    pullIn({
      organizations: [organizationRow({ id: "org-1", name: "Northwind" })],
      groups: [
        groupRow({
          id: "group-1",
          groupName: "Engineering",
          managerUserId: "boss",
          defaultVacationDays: 20,
          defaultHomeOfficeDays: 4,
          defaultSickDays: 3,
          workingDays: [1, 2, 3, 4],
          holidayCountry: "SK",
        }),
      ],
      groupUsers: [membershipIn("group-1")],
    });

    expect(myGroups()).toEqual([
      {
        id: "group-1",
        name: "Engineering",
        organizationName: "Northwind",
        defaultVacationDays: 20,
        defaultHomeOfficeDays: 4,
        defaultSickDays: 3,
        workingDays: [1, 2, 3, 4],
        holidayCountry: "SK",
        role: null,
      },
    ]);
  });

  it("returns no organization name while the store lacks the organization", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [membershipIn("group-1")],
    });

    expect(myGroups()[0]?.organizationName).toBeNull();
  });

  it("returns no role for a plain member, view access included", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [membershipIn("group-1", { viewAccess: true })],
    });

    expect(myGroups()[0]?.role).toBeNull();
  });

  it("returns manager over admin and approver access", () => {
    pullIn({
      groups: [groupRow({ managerUserId: VIEWER })],
      groupUsers: [membershipIn("group-1", { adminAccess: true, approverAccess: true })],
    });

    expect(myGroups()[0]?.role).toBe("manager");
  });

  it("returns admin over approver access", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [membershipIn("group-1", { adminAccess: true, approverAccess: true })],
    });

    expect(myGroups()[0]?.role).toBe("admin");
  });

  it("returns approver for approver access alone", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [membershipIn("group-1", { approverAccess: true })],
    });

    expect(myGroups()[0]?.role).toBe("approver");
  });

  it("returns no role for the group's main or temp approver without approver access", () => {
    pullIn({
      groups: [
        groupRow({ managerUserId: "boss", mainApprovalUser: VIEWER, tempApprovalUser: VIEWER }),
      ],
      groupUsers: [membershipIn("group-1")],
    });

    expect(myGroups()[0]?.role).toBeNull();
  });

  it("returns the viewer's own flags, never another member's", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [
        membershipIn("group-1"),
        groupUserRow({ id: "other", userId: "user-2", adminAccess: true, approverAccess: true }),
      ],
    });

    expect(myGroups()).toHaveLength(1);
    expect(myGroups()[0]?.role).toBeNull();
  });

  it("returns no group the viewer only manages without a membership", () => {
    pullIn({
      groups: [groupRow({ managerUserId: VIEWER })],
      groupUsers: [groupUserRow({ id: "other", userId: "user-2" })],
    });

    expect(myGroups()).toEqual([]);
  });

  it("returns no group whose membership ended", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [groupUserRow({ userId: VIEWER, ...PLAIN, deletedAt: DELETED })],
    });

    expect(myGroups()).toEqual([]);
  });

  it("returns no deleted group", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss", deletedAt: DELETED })],
      groupUsers: [membershipIn("group-1")],
    });

    expect(myGroups()).toEqual([]);
  });

  it("returns the groups by name", () => {
    pullIn({
      groups: [
        groupRow({ id: "group-s", groupName: "Support" }),
        groupRow({ id: "group-d", groupName: "Design" }),
        groupRow({ id: "group-m", groupName: "Marketing" }),
      ],
      groupUsers: [membershipIn("group-s"), membershipIn("group-d"), membershipIn("group-m")],
    });

    expect(myGroups().map((group) => group.name)).toEqual(["Design", "Marketing", "Support"]);
  });
});
