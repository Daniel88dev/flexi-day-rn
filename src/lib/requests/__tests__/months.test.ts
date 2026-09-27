import {
  addMonths,
  currentMonth,
  isoDay,
  monthRange,
  monthOffset,
  monthsWithin,
  requestMonthBounds,
  stepMonth,
} from "../months";

const TODAY = new Date(2026, 8, 26, 14, 0);
const BOUNDS = requestMonthBounds(TODAY);

describe("requestMonthBounds", () => {
  it("returns January of last year as the first month, where the store's data starts", () => {
    expect(BOUNDS.first).toEqual({ year: 2025, month: 1 });
  });

  it("returns December of next year as the last month, the end of the bookable window", () => {
    expect(BOUNDS.last).toEqual({ year: 2027, month: 12 });
  });
});

describe("currentMonth", () => {
  it("returns the month the date falls in, 1-based", () => {
    expect(currentMonth(TODAY)).toEqual({ year: 2026, month: 9 });
  });
});

describe("addMonths", () => {
  it("returns the month a whole number of months away, across years", () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 });
    expect(addMonths({ year: 2026, month: 2 }, -3)).toEqual({ year: 2025, month: 11 });
  });
});

describe("stepMonth", () => {
  it("returns the month before", () => {
    expect(stepMonth({ year: 2026, month: 9 }, -1, BOUNDS)).toEqual({ year: 2026, month: 8 });
  });

  it("returns the month after", () => {
    expect(stepMonth({ year: 2026, month: 9 }, 1, BOUNDS)).toEqual({ year: 2026, month: 10 });
  });

  it("returns December of the year before when stepping back from January", () => {
    expect(stepMonth({ year: 2026, month: 1 }, -1, BOUNDS)).toEqual({ year: 2025, month: 12 });
  });

  it("returns January of the next year when stepping on from December", () => {
    expect(stepMonth({ year: 2026, month: 12 }, 1, BOUNDS)).toEqual({ year: 2027, month: 1 });
  });

  it("returns null before January of last year", () => {
    expect(stepMonth({ year: 2025, month: 1 }, -1, BOUNDS)).toBeNull();
  });

  it("returns null after December of next year", () => {
    expect(stepMonth({ year: 2027, month: 12 }, 1, BOUNDS)).toBeNull();
  });
});

describe("monthsWithin", () => {
  it("returns every month from January of last year to December of next year", () => {
    const months = monthsWithin(BOUNDS);

    expect(months).toHaveLength(36);
    expect(months[0]).toEqual({ year: 2025, month: 1 });
    expect(months[20]).toEqual({ year: 2026, month: 9 });
    expect(months[35]).toEqual({ year: 2027, month: 12 });
  });
});

describe("monthOffset", () => {
  it("returns how many months a month lies after the first bound", () => {
    expect(monthOffset({ year: 2026, month: 9 }, BOUNDS)).toBe(20);
    expect(monthOffset({ year: 2025, month: 1 }, BOUNDS)).toBe(0);
  });
});

describe("isoDay", () => {
  it("returns the ISO date of a day of the month", () => {
    expect(isoDay({ year: 2026, month: 3 }, 7)).toBe("2026-03-07");
  });
});

describe("monthRange", () => {
  it("returns the month's first day and the first day after it", () => {
    expect(monthRange({ year: 2026, month: 12 })).toEqual({
      from: "2026-12-01",
      until: "2027-01-01",
    });
  });
});
