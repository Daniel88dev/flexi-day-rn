import { gridRange, monthLabelColumn, monthWeeks, seamColumn, weeksCovering } from "../month-grid";

const dates = (weeks: ReturnType<typeof monthWeeks>) =>
  weeks.map((week) => week.map((cell) => cell.date));

describe("weeksCovering", () => {
  it("returns whole Monday-first weeks from the Monday before the first day to the Sunday after the last", () => {
    expect(weeksCovering("2026-10-07", "2026-10-13")).toEqual([
      [
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
        "2026-10-11",
      ],
      [
        "2026-10-12",
        "2026-10-13",
        "2026-10-14",
        "2026-10-15",
        "2026-10-16",
        "2026-10-17",
        "2026-10-18",
      ],
    ]);
  });
});

describe("monthWeeks", () => {
  it("returns padding cells with the adjacent months' real dates, marked outside the month", () => {
    const weeks = monthWeeks({ year: 2026, month: 10 });

    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      { date: "2026-09-28", day: 28, inMonth: false },
      { date: "2026-09-29", day: 29, inMonth: false },
      { date: "2026-09-30", day: 30, inMonth: false },
      { date: "2026-10-01", day: 1, inMonth: true },
      { date: "2026-10-02", day: 2, inMonth: true },
      { date: "2026-10-03", day: 3, inMonth: true },
      { date: "2026-10-04", day: 4, inMonth: true },
    ]);
    expect(weeks[4].map((cell) => [cell.day, cell.inMonth])).toEqual([
      [26, true],
      [27, true],
      [28, true],
      [29, true],
      [30, true],
      [31, true],
      [1, false],
    ]);
    expect(weeks[4][6].date).toBe("2026-11-01");
  });

  it("returns no leading padding for a month that starts on a Monday", () => {
    const weeks = monthWeeks({ year: 2027, month: 2 });

    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toEqual({ date: "2027-02-01", day: 1, inMonth: true });
    expect(weeks[3][6]).toEqual({ date: "2027-02-28", day: 28, inMonth: true });
    expect(weeks.flat().every((cell) => cell.inMonth)).toBe(true);
  });

  it("returns six leading padding days for a month that starts on a Sunday", () => {
    const weeks = monthWeeks({ year: 2026, month: 11 });

    expect(weeks).toHaveLength(6);
    expect(weeks[0].map((cell) => cell.inMonth)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(weeks[0][0].date).toBe("2026-10-26");
    expect(weeks[0][6].date).toBe("2026-11-01");
    expect(weeks[5][0]).toEqual({ date: "2026-11-30", day: 30, inMonth: true });
    expect(weeks[5][6]).toEqual({ date: "2026-12-06", day: 6, inMonth: false });
  });

  it("returns padding across the year boundary", () => {
    const weeks = dates(monthWeeks({ year: 2027, month: 1 }));

    expect(weeks[0].slice(0, 4)).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"]);
    expect(weeks[weeks.length - 1].slice(-1)).toEqual(["2027-01-31"]);
  });
});

describe("gridRange", () => {
  it("returns the first cell up to, not including, the day after the last cell", () => {
    expect(gridRange({ year: 2026, month: 11 })).toEqual({
      from: "2026-10-26",
      until: "2026-12-07",
    });
  });

  it("returns the month itself when it fills whole weeks", () => {
    expect(gridRange({ year: 2027, month: 2 })).toEqual({
      from: "2027-02-01",
      until: "2027-03-01",
    });
  });

  it("returns a range reaching into the previous December for January", () => {
    expect(gridRange({ year: 2025, month: 1 })).toEqual({
      from: "2024-12-30",
      until: "2025-02-03",
    });
  });
});

describe("seamColumn", () => {
  it("returns the column of the 1st where the month changes mid-week", () => {
    const weeks = monthWeeks({ year: 2026, month: 10 });

    expect(seamColumn(weeks[0])).toBe(3);
    expect(seamColumn(weeks[4])).toBe(6);
  });

  it("returns null for a week inside the month", () => {
    expect(seamColumn(monthWeeks({ year: 2026, month: 10 })[2])).toBeNull();
  });

  it("returns null where the month changes on a Monday", () => {
    const weeks = monthWeeks({ year: 2027, month: 2 });

    expect(seamColumn(weeks[0])).toBeNull();
    expect(seamColumn(weeks[3])).toBeNull();
  });
});

describe("monthLabelColumn", () => {
  it("returns the grid's first cell for the leading days and the first trailing day after the month", () => {
    const weeks = monthWeeks({ year: 2026, month: 11 });

    expect(monthLabelColumn(weeks[0])).toBe(0);
    expect(monthLabelColumn(weeks[5])).toBe(1);
  });

  it("returns null for a week with no adjacent days", () => {
    const weeks = monthWeeks({ year: 2027, month: 2 });

    expect(weeks.map(monthLabelColumn)).toEqual([null, null, null, null]);
  });
});
