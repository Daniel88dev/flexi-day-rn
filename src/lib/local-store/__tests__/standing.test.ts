import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import type { StoreRuntime } from "../runtime";
import { groupStanding } from "../standing";
import { groupRow, groupUserRow, syncPage } from "../test-support/sync-fixtures";
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

const standing = () => groupStanding(store.getDatabase());

describe("groupStanding", () => {
  it("returns no membership and no approving for an empty store", () => {
    expect(standing()).toEqual({ member: false, approver: false });
  });

  it("returns a plain member who approves nowhere", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [groupUserRow({ userId: VIEWER, ...PLAIN })],
    });

    expect(standing()).toEqual({ member: true, approver: false });
  });

  it("returns an approver for the group's manager", () => {
    pullIn({
      groups: [groupRow({ managerUserId: VIEWER })],
      groupUsers: [groupUserRow({ userId: VIEWER, ...PLAIN })],
    });

    expect(standing().approver).toBe(true);
  });

  it("returns an approver for the main approver", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss", mainApprovalUser: VIEWER })],
      groupUsers: [groupUserRow({ userId: VIEWER, ...PLAIN })],
    });

    expect(standing().approver).toBe(true);
  });

  it("returns an approver for the temp approver", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss", tempApprovalUser: VIEWER })],
      groupUsers: [groupUserRow({ userId: VIEWER, ...PLAIN })],
    });

    expect(standing().approver).toBe(true);
  });

  it("returns an approver for a member given approver access", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [groupUserRow({ userId: VIEWER, ...PLAIN, approverAccess: true })],
    });

    expect(standing().approver).toBe(true);
  });

  it("returns no approving for admin access alone", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [groupUserRow({ userId: VIEWER, ...PLAIN, adminAccess: true })],
    });

    expect(standing().approver).toBe(false);
  });

  it("returns no approving for approver access someone else holds", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [
        groupUserRow({ id: "mine", userId: VIEWER, ...PLAIN }),
        groupUserRow({ id: "theirs", userId: "user-2", ...PLAIN, approverAccess: true }),
      ],
    });

    expect(standing().approver).toBe(false);
  });

  it("returns no approving in a deleted group", () => {
    pullIn({
      groups: [groupRow({ managerUserId: VIEWER, deletedAt: DELETED })],
      groupUsers: [groupUserRow({ userId: VIEWER, ...PLAIN, approverAccess: true })],
    });

    expect(standing()).toEqual({ member: false, approver: false });
  });

  it("returns no approving from a membership that ended", () => {
    pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [
        groupUserRow({ userId: VIEWER, ...PLAIN, approverAccess: true, deletedAt: DELETED }),
      ],
    });

    expect(standing()).toEqual({ member: false, approver: false });
  });
});
