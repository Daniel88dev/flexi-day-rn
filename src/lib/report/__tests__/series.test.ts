import { crossMember2026, erinOnDefaults } from "@/test-support/report";

import type { ReportSummaryRow } from "../types";
import type { DatedUsage } from "../window";
import {
  buildTeamMonthlySeries,
  groupAllowance,
  monthlySeriesFor,
  monthlyTargetFor,
  seriesTotal,
  totalQuotaFor,
} from "../series";
import { calendarMonths, trailingMonths } from "../window";

const slots = trailingMonths(new Date(2026, 1, 16));

const usage = (overrides: Partial<DatedUsage>): DatedUsage => ({
  userId: "u-alice",
  groupId: "g-team",
  year: 2026,
  month: 1,
  vacationType: "VACATION",
  used: 0,
  pending: 0,
  ...overrides,
});

describe("buildTeamMonthlySeries", () => {
  it("returns one zero-filled row per slot with every member present", () => {
    const series = buildTeamMonthlySeries([], ["u-alice", "u-bob"], "VACATION", slots);

    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ year: 2025, month: 3, values: { "u-alice": 0, "u-bob": 0 } });
  });

  it("returns used plus pending days, summed across groups, in the slot of their stamped year", () => {
    const series = buildTeamMonthlySeries(
      [
        usage({ year: 2025, month: 12, used: 2, pending: 1 }),
        usage({ year: 2025, month: 12, groupId: "g-support", used: 0.5 }),
        usage({ year: 2026, month: 1, userId: "u-bob", used: 3 }),
      ],
      ["u-alice", "u-bob"],
      "VACATION",
      slots
    );

    expect(series[9]).toEqual({ year: 2025, month: 12, values: { "u-alice": 3.5, "u-bob": 0 } });
    expect(series[10]).toEqual({ year: 2026, month: 1, values: { "u-alice": 0, "u-bob": 3 } });
  });

  it("returns no row for months outside the window, other types or people not asked for", () => {
    const series = buildTeamMonthlySeries(
      [
        usage({ year: 2026, month: 3, used: 4 }),
        usage({ year: 2025, month: 2, used: 4 }),
        usage({ month: 1, vacationType: "HOME_OFFICE", used: 4 }),
        usage({ month: 1, userId: "u-carol", used: 4 }),
      ],
      ["u-alice"],
      "VACATION",
      slots
    );

    expect(seriesTotal(series)).toBe(0);
    expect(series.every((row) => Object.keys(row.values).join() === "u-alice")).toBe(true);
  });
});

describe("seriesTotal", () => {
  it("returns every member's days across the window", () => {
    const series = buildTeamMonthlySeries(
      [usage({ year: 2025, month: 6, used: 1.5 }), usage({ month: 2, userId: "u-bob", used: 2 })],
      ["u-alice", "u-bob"],
      "VACATION",
      slots
    );

    expect(seriesTotal(series)).toBe(3.5);
  });
});

describe("monthlySeriesFor", () => {
  it("returns one zero-filled point per slot", () => {
    const series = monthlySeriesFor([], "u-alice", slots, "VACATION");

    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ year: 2025, month: 3, used: 0, pending: 0 });
    expect(series[11]).toEqual({ year: 2026, month: 2, used: 0, pending: 0 });
  });

  it("returns used and pending apart, summed across groups, in the slot of their stamped year", () => {
    const series = monthlySeriesFor(
      [
        usage({ year: 2025, month: 12, used: 2, pending: 1 }),
        usage({ year: 2025, month: 12, groupId: "g-support", used: 0.5, pending: 0.5 }),
        usage({ year: 2026, month: 2, used: 1.5 }),
      ],
      "u-alice",
      slots,
      "VACATION"
    );

    expect(series[9]).toEqual({ year: 2025, month: 12, used: 2.5, pending: 1.5 });
    expect(series[11]).toEqual({ year: 2026, month: 2, used: 1.5, pending: 0 });
  });

  it("returns nothing for other people, other types and months outside the window", () => {
    const series = monthlySeriesFor(
      [
        usage({ userId: "u-bob", used: 3 }),
        usage({ vacationType: "SICK_DAY", used: 3 }),
        usage({ year: 2025, month: 2, used: 3 }),
        usage({ year: 2026, month: 3, used: 3 }),
      ],
      "u-alice",
      slots,
      "VACATION"
    );

    expect(series.every((point) => point.used === 0 && point.pending === 0)).toBe(true);
  });
});

const summary = (overrides: Partial<ReportSummaryRow>): ReportSummaryRow => ({
  userId: "u-alice",
  groupId: "g-team",
  vacationType: "VACATION",
  carriedOverDays: 0,
  yearQuota: 25,
  usedToDate: 0,
  plannedRemaining: 0,
  pending: 0,
  remaining: 25,
  ...overrides,
});

describe("totalQuotaFor", () => {
  it("returns the year's grant plus carry-over of one type, across every group", () => {
    const rows = [
      summary({ yearQuota: 20, carriedOverDays: 3 }),
      summary({ groupId: "g-support", yearQuota: 5 }),
      summary({ vacationType: "HOME_OFFICE", yearQuota: 50 }),
      summary({ userId: "u-bob", yearQuota: 22 }),
    ];

    expect(totalQuotaFor(rows, "u-alice", "VACATION")).toBe(28);
    expect(totalQuotaFor(rows, "u-alice", "HOME_OFFICE")).toBe(50);
    expect(totalQuotaFor(rows, "u-alice", "SICK_DAY")).toBe(0);
  });
});

describe("monthlyTargetFor", () => {
  it("returns the allowance spread evenly over a calendar year", () => {
    expect(monthlyTargetFor(calendarMonths(2026), 24)).toBe(2);
  });

  it("returns zero for a window across two years", () => {
    expect(monthlyTargetFor(slots, 24)).toBe(0);
  });

  it("returns zero without an allowance or a window", () => {
    expect(monthlyTargetFor(calendarMonths(2026), 0)).toBe(0);
    expect(monthlyTargetFor([], 24)).toBe(0);
  });
});

describe("groupAllowance", () => {
  it("returns the group defaults from the summary for a person with no quota row", () => {
    expect(erinOnDefaults.quotas).toHaveLength(0);

    expect(groupAllowance(erinOnDefaults.summary, "u-erin", "g-support")).toEqual({
      carriedOverDays: 0,
      vacationDays: 25,
      homeOfficeDays: 10,
      sickDays: null,
    });
  });

  it("returns the sick days where the summary meters them", () => {
    expect(groupAllowance(crossMember2026.summary, "u-bob", "g-team")).toEqual({
      carriedOverDays: 0,
      vacationDays: 22,
      homeOfficeDays: 0,
      sickDays: 5,
    });
  });

  it("returns the summary's figures over a quota row that says otherwise", () => {
    const rows = [summary({ yearQuota: 28, carriedOverDays: 3 })];

    expect(groupAllowance(rows, "u-alice", "g-team")).toMatchObject({
      carriedOverDays: 3,
      vacationDays: 28,
    });
  });

  it("returns each group's own figures and zeros for a group with no line", () => {
    const rows = [summary({ yearQuota: 20 }), summary({ groupId: "g-support", yearQuota: 5 })];

    expect(groupAllowance(rows, "u-alice", "g-support").vacationDays).toBe(5);
    expect(groupAllowance(rows, "u-bob", "g-team")).toEqual({
      carriedOverDays: 0,
      vacationDays: 0,
      homeOfficeDays: 0,
      sickDays: null,
    });
  });
});
