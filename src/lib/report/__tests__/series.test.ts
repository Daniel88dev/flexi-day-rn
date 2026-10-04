import type { DatedUsage } from "../window";
import { buildTeamMonthlySeries, seriesTotal } from "../series";
import { trailingMonths } from "../window";

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
