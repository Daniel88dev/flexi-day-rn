import { memberBadges, orderedMembers, quotaFigures } from "@/lib/groups/members";
import type { UserYearQuota } from "@/lib/query";
import { groupMember, userYearQuota } from "@/test-support/groups";

const member = groupMember;
const quota = (patch: Partial<UserYearQuota> = {}) =>
  userYearQuota("carol", { sickDays: 3, carriedOverDays: 2, ...patch });

const DEFAULTS = { vacationDays: 20, homeOfficeDays: 5, sickDays: 4 };

describe("orderedMembers", () => {
  it("returns the manager first, then everyone else by name", () => {
    const rows = [
      member("bob", "Bob Dvorak"),
      member("olivia", "Olivia Owner"),
      member("alice", "Alice Novak"),
      member("carol", "Carol Svoboda"),
    ];

    expect(orderedMembers(rows, "olivia").map((row) => row.userId)).toEqual([
      "olivia",
      "alice",
      "bob",
      "carol",
    ]);
  });

  it("returns everyone by name when the manager is not a member", () => {
    const rows = [member("bob", "Bob"), member("alice", "Alice")];

    expect(orderedMembers(rows, "someone-else").map((row) => row.userId)).toEqual(["alice", "bob"]);
  });

  it("leaves out a member who has left", () => {
    const rows = [member("alice", "Alice"), member("bob", "Bob", { deletedAt: "2026-09-01" })];

    expect(orderedMembers(rows, "alice").map((row) => row.userId)).toEqual(["alice"]);
  });
});

describe("memberBadges", () => {
  it("returns Manager, Admin and Approver in that order", () => {
    const row = member("olivia", "Olivia", { adminAccess: true, approverAccess: true });

    expect(memberBadges(row, "olivia")).toEqual({
      roles: ["manager", "admin", "approver"],
      tracked: true,
    });
  });

  it("returns no badge for view access or for being tracked", () => {
    expect(memberBadges(member("bob", "Bob", { viewAccess: true }), "olivia")).toEqual({
      roles: [],
      tracked: true,
    });
  });

  it("returns untracked when the member is not a controlled user", () => {
    expect(memberBadges(member("dave", "Dave", { controlledUser: false }), "olivia")).toEqual({
      roles: [],
      tracked: false,
    });
  });
});

describe("quotaFigures", () => {
  it("returns vacation, home office and carried over, with a plus on what was carried", () => {
    expect(quotaFigures(quota(), DEFAULTS, false)).toEqual([
      { key: "vacation", value: "25" },
      { key: "homeOffice", value: "10" },
      { key: "carriedOver", value: "+2" },
    ]);
  });

  it("returns the sick days only while the organization offers the benefit", () => {
    expect(quotaFigures(quota(), DEFAULTS, true).map((figure) => figure.key)).toEqual([
      "vacation",
      "homeOffice",
      "sickDays",
      "carriedOver",
    ]);
    expect(quotaFigures(quota(), DEFAULTS, true)[2]).toEqual({ key: "sickDays", value: "3" });
  });

  it("returns 0 carried over without a plus", () => {
    expect(quotaFigures(quota({ carriedOverDays: 0 }), DEFAULTS, false)[2]).toEqual({
      key: "carriedOver",
      value: "0",
    });
  });

  it("returns the group's defaults for a member without a quota row", () => {
    expect(quotaFigures(undefined, DEFAULTS, true)).toEqual([
      { key: "vacation", value: "20" },
      { key: "homeOffice", value: "5" },
      { key: "sickDays", value: "4" },
      { key: "carriedOver", value: "0" },
    ]);
  });
});
