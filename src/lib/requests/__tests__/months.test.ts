import {
  addMonths,
  currentMonth,
  defaultMonthWindow,
  isoDay,
  monthRange,
  monthOf,
  monthOffset,
  monthsWithin,
  monthWindowLabel,
  monthWindowRange,
  requestMonthBounds,
  resizeMonthWindow,
  sameMonthWindow,
  shiftMonthWindow,
  stepMonth,
} from "../months";
import { en } from "@/i18n/en";

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

describe("monthOf", () => {
  it("returns the month an ISO day falls in", () => {
    expect(monthOf("2026-09-28")).toEqual({ year: 2026, month: 9 });
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

describe("defaultMonthWindow", () => {
  it("returns the current month and the next two", () => {
    expect(defaultMonthWindow(TODAY)).toEqual({ first: { year: 2026, month: 9 }, length: 3 });
  });
});

describe("shiftMonthWindow", () => {
  it("returns the window a month on, across the year boundary", () => {
    expect(shiftMonthWindow({ first: { year: 2026, month: 11 }, length: 3 }, 1, BOUNDS)).toEqual({
      first: { year: 2026, month: 12 },
      length: 3,
    });
  });

  it("returns the window a month back", () => {
    expect(shiftMonthWindow({ first: { year: 2026, month: 1 }, length: 6 }, -1, BOUNDS)).toEqual({
      first: { year: 2025, month: 12 },
      length: 6,
    });
  });

  it("returns null when the window would start before January of last year", () => {
    expect(shiftMonthWindow({ first: { year: 2025, month: 1 }, length: 3 }, -1, BOUNDS)).toBeNull();
  });

  it("returns null when the window's last month would pass December of next year", () => {
    expect(shiftMonthWindow({ first: { year: 2027, month: 10 }, length: 3 }, 1, BOUNDS)).toBeNull();
  });
});

describe("resizeMonthWindow", () => {
  it("returns the window from the same first month at the new length", () => {
    expect(resizeMonthWindow({ first: { year: 2026, month: 9 }, length: 3 }, 6, BOUNDS)).toEqual({
      first: { year: 2026, month: 9 },
      length: 6,
    });
    expect(resizeMonthWindow({ first: { year: 2026, month: 9 }, length: 3 }, 1, BOUNDS)).toEqual({
      first: { year: 2026, month: 9 },
      length: 1,
    });
  });

  it("returns the window pulled back so it ends on December of next year", () => {
    expect(resizeMonthWindow({ first: { year: 2027, month: 10 }, length: 3 }, 6, BOUNDS)).toEqual({
      first: { year: 2027, month: 7 },
      length: 6,
    });
  });
});

describe("monthWindowLabel", () => {
  const SHORT = en.calendar.monthsShort;

  it("returns one month with its year", () => {
    expect(monthWindowLabel({ first: { year: 2026, month: 10 }, length: 1 }, SHORT)).toBe(
      "Oct 2026"
    );
  });

  it("returns the first and last month under one year when the window stays in it", () => {
    expect(monthWindowLabel({ first: { year: 2026, month: 10 }, length: 3 }, SHORT)).toBe(
      "Oct – Dec 2026"
    );
  });

  it("returns each end with its own year when the window crosses into the next", () => {
    expect(monthWindowLabel({ first: { year: 2026, month: 11 }, length: 3 }, SHORT)).toBe(
      "Nov 2026 – Jan 2027"
    );
  });
});

describe("monthWindowRange", () => {
  it("returns the window's first day and the first day after its last month", () => {
    expect(monthWindowRange({ first: { year: 2026, month: 11 }, length: 3 })).toEqual({
      from: "2026-11-01",
      until: "2027-02-01",
    });
  });
});

describe("sameMonthWindow", () => {
  it("returns true only for the same first month at the same length", () => {
    const window = { first: { year: 2026, month: 9 }, length: 3 } as const;

    expect(sameMonthWindow(window, { first: { year: 2026, month: 9 }, length: 3 })).toBe(true);
    expect(sameMonthWindow(window, { first: { year: 2026, month: 9 }, length: 6 })).toBe(false);
    expect(sameMonthWindow(window, { first: { year: 2025, month: 9 }, length: 3 })).toBe(false);
  });
});
