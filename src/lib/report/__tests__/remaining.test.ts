import {
  buildMemberRemaining,
  daysLeftScale,
  remainingFor,
  uniqueMembers,
  usageParts,
} from "../remaining";
import type { ReportScopeMember, ReportSummaryRow } from "../types";

function member(id: string, name: string, groupId = "g-1"): ReportScopeMember {
  return { id, name, initials: name.slice(0, 2), avatarColor: "hsl(200, 60%, 50%)", groupId };
}

function row(overrides: Partial<ReportSummaryRow>): ReportSummaryRow {
  return {
    userId: "u-1",
    groupId: "g-1",
    vacationType: "VACATION",
    carriedOverDays: 0,
    yearQuota: 0,
    usedToDate: 0,
    plannedRemaining: 0,
    pending: 0,
    remaining: 0,
    ...overrides,
  };
}

const alice = member("u-1", "Alice");

describe("remainingFor", () => {
  it("returns the carry-over drawn down before the year's grant", () => {
    const result = remainingFor(
      alice,
      [row({ carriedOverDays: 4, yearQuota: 20, usedToDate: 3, plannedRemaining: 0.5 })],
      "VACATION"
    );

    expect(result).toMatchObject({
      carriedOver: 4,
      yearQuota: 20,
      usedToDate: 3,
      planned: 0.5,
      carriedOverLeft: 0.5,
      yearLeft: 20,
      overdraft: 0,
      remaining: 20.5,
    });
  });

  it("returns the year's grant drawn down once the carry-over is spent", () => {
    const result = remainingFor(
      alice,
      [row({ carriedOverDays: 2, yearQuota: 20, usedToDate: 7, plannedRemaining: 3 })],
      "VACATION"
    );

    expect(result).toMatchObject({ carriedOverLeft: 0, yearLeft: 12, remaining: 12 });
  });

  it("returns an overdraft below zero once the whole allowance is spent", () => {
    const result = remainingFor(
      alice,
      [row({ yearQuota: 22, usedToDate: 23.5, pending: 1 })],
      "VACATION"
    );

    expect(result).toMatchObject({
      carriedOverLeft: 0,
      yearLeft: 0,
      overdraft: -1.5,
      remaining: -1.5,
      pending: 1,
    });
  });

  it("returns the sum across every group the member is in, for the one type asked", () => {
    const result = remainingFor(
      alice,
      [
        row({ groupId: "g-1", yearQuota: 10, usedToDate: 2 }),
        row({ groupId: "g-2", yearQuota: 5, usedToDate: 1, carriedOverDays: 1 }),
        row({ groupId: "g-1", vacationType: "HOME_OFFICE", yearQuota: 50, usedToDate: 9 }),
        row({ userId: "u-2", yearQuota: 30 }),
      ],
      "VACATION"
    );

    expect(result).toMatchObject({ carriedOver: 1, yearQuota: 15, usedToDate: 3, remaining: 13 });
  });

  it("returns zeros for a member with no line of that type", () => {
    expect(remainingFor(alice, [], "SICK_DAY")).toMatchObject({
      carriedOver: 0,
      yearQuota: 0,
      remaining: 0,
    });
  });
});

describe("buildMemberRemaining", () => {
  it("returns one row per member, most days left first, then by name", () => {
    const rows = buildMemberRemaining(
      [member("u-3", "Carol"), member("u-2", "Bob"), member("u-1", "Alice"), member("u-2", "Bob")],
      [
        row({ userId: "u-1", yearQuota: 10 }),
        row({ userId: "u-2", yearQuota: 20 }),
        row({ userId: "u-3", yearQuota: 10 }),
      ],
      "VACATION"
    );

    expect(rows.map((entry) => entry.member.name)).toEqual(["Bob", "Alice", "Carol"]);
  });
});

describe("uniqueMembers", () => {
  it("returns each person once, by name", () => {
    expect(
      uniqueMembers([
        member("u-2", "Bob", "g-1"),
        member("u-1", "Alice"),
        member("u-2", "Bob", "g-2"),
      ]).map((entry) => entry.id)
    ).toEqual(["u-1", "u-2"]);
  });
});

describe("daysLeftScale", () => {
  it("returns the largest days left and the largest overdraft across every row", () => {
    const rows = [
      remainingFor(alice, [row({ carriedOverDays: 3, yearQuota: 28 })], "VACATION"),
      remainingFor(
        member("u-2", "Bob"),
        [row({ userId: "u-2", yearQuota: 22, usedToDate: 23.5 })],
        "VACATION"
      ),
      remainingFor(
        member("u-3", "Carol"),
        [row({ userId: "u-3", yearQuota: 20, usedToDate: 26 })],
        "VACATION"
      ),
    ];

    expect(daysLeftScale(rows)).toEqual({ left: 31, over: 6 });
  });

  it("returns a scale of at least one day so an empty list draws nothing", () => {
    expect(daysLeftScale([])).toEqual({ left: 1, over: 0 });
  });
});

describe("usageParts", () => {
  it("returns used, planned and pending, leaving out the parts that are zero", () => {
    const entry = remainingFor(
      alice,
      [row({ yearQuota: 28, usedToDate: 10, plannedRemaining: 0, pending: 2 })],
      "VACATION"
    );

    expect(usageParts(entry)).toEqual([
      { part: "used", days: 10 },
      { part: "pending", days: 2 },
    ]);
  });

  it("returns nothing for someone who has taken and booked nothing", () => {
    expect(usageParts(remainingFor(alice, [row({ yearQuota: 20 })], "VACATION"))).toEqual([]);
  });
});
