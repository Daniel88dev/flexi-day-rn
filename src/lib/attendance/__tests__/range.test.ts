import { attendanceMonth } from "@/test-support/attendance";

import {
  holdsToday,
  monthsOfWeek,
  pastDaysNewestFirst,
  startOfWeek,
  stepRange,
  weekDates,
  weekRead,
  yearMonthOf,
} from "../range";

describe("weekDates", () => {
  it("returns Monday to Sunday of the week a date falls in", () => {
    expect(weekDates("2026-09-27")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(weekDates("2026-09-21")[0]).toBe("2026-09-21");
  });
});

describe("weekDates across New Year", () => {
  it("returns the days of a week that runs into the next year", () => {
    expect(weekDates("2027-01-01")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("startOfWeek", () => {
  it("returns the Monday of the week, the day itself on a Monday", () => {
    expect(startOfWeek("2026-09-27")).toBe("2026-09-21");
    expect(startOfWeek("2026-09-21")).toBe("2026-09-21");
    expect(startOfWeek("2026-03-01")).toBe("2026-02-23");
  });
});

describe("yearMonthOf", () => {
  it("returns the calendar month of a business date", () => {
    expect(yearMonthOf("2026-09-27")).toEqual({ year: 2026, month: 9 });
    expect(yearMonthOf("2027-01-01")).toEqual({ year: 2027, month: 1 });
  });
});

describe("monthsOfWeek", () => {
  it("returns the one month a week sits inside", () => {
    expect(monthsOfWeek("2026-09-23")).toEqual([{ year: 2026, month: 9 }]);
  });

  it("returns both months of a week that straddles a month's end, earlier first", () => {
    expect(monthsOfWeek("2026-10-01")).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
    ]);
  });

  it("returns both years' months across New Year", () => {
    expect(monthsOfWeek("2026-12-31")).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
  });
});

describe("weekRead", () => {
  const september = attendanceMonth(2026, 9, { balanceMode: "MONTHLY" });
  const october = attendanceMonth(2026, 10, { balanceMode: "MONTHLY" });
  const straddling = weekDates("2026-10-01");

  it("returns the week's seven days from both months once both have answered", () => {
    const read = weekRead(straddling, [
      { data: september, isPending: false },
      { data: october, isPending: false },
    ]);

    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.days.map((day) => day.businessDate)).toEqual(straddling);
    expect(read.mode).toBe("MONTHLY");
  });

  it("returns loading while either month is still on its way", () => {
    expect(
      weekRead(straddling, [
        { data: september, isPending: false },
        { data: undefined, isPending: true },
      ]).kind
    ).toBe("loading");
  });

  it("returns failed when either month failed, rather than half a week", () => {
    expect(
      weekRead(straddling, [
        { data: september, isPending: false },
        { data: undefined, isPending: false },
      ]).kind
    ).toBe("failed");
  });

  it("returns a week inside one month from that month alone", () => {
    const read = weekRead(weekDates("2026-09-23"), [{ data: september, isPending: false }]);
    expect(read.kind === "ready" && read.days.map((day) => day.businessDate)).toEqual(
      weekDates("2026-09-23")
    );
  });
});

describe("pastDaysNewestFirst", () => {
  it("returns the days already begun, today first, and none still to come", () => {
    const upcoming = Object.fromEntries(
      [28, 29, 30].map((day) => [`2026-09-${day}`, { upcoming: true }])
    );
    const month = attendanceMonth(2026, 9, {}, upcoming);

    const days = pastDaysNewestFirst(month).map((day) => day.businessDate);

    expect(days).toHaveLength(27);
    expect(days.slice(0, 3)).toEqual(["2026-09-27", "2026-09-26", "2026-09-25"]);
    expect(days.at(-1)).toBe("2026-09-01");
  });

  it("returns no upcoming day off either", () => {
    const month = attendanceMonth(
      2026,
      9,
      {},
      {
        "2026-09-28": {
          upcoming: true,
          exclusion: { cause: "HOLIDAY", extent: "FULL", label: "St Wenceslas Day" },
        },
      }
    );

    expect(pastDaysNewestFirst(month).map((day) => day.businessDate)).not.toContain("2026-09-28");
  });
});

describe("stepRange", () => {
  const TODAY = "2026-09-27";

  it("returns the Monday of the week before, and none past the week holding today", () => {
    expect(stepRange("week", TODAY, -1, TODAY)).toBe("2026-09-14");
    expect(stepRange("week", "2026-09-10", 1, TODAY)).toBe("2026-09-14");
    expect(stepRange("week", TODAY, 1, TODAY)).toBeNull();
  });

  it("returns today when a step lands on the week holding it", () => {
    expect(stepRange("week", "2026-09-16", 1, TODAY)).toBe(TODAY);
  });

  it("returns the first of the month before, and none past the month holding today", () => {
    expect(stepRange("month", TODAY, -1, TODAY)).toBe("2026-08-01");
    expect(stepRange("month", "2026-01-15", -1, TODAY)).toBe("2025-12-01");
    expect(stepRange("month", "2026-08-01", 1, TODAY)).toBe(TODAY);
    expect(stepRange("month", TODAY, 1, TODAY)).toBeNull();
  });
});

describe("holdsToday", () => {
  it("returns whether the week or month of an anchor holds today", () => {
    expect(holdsToday("week", "2026-09-21", "2026-09-27")).toBe(true);
    expect(holdsToday("week", "2026-09-20", "2026-09-27")).toBe(false);
    expect(holdsToday("month", "2026-09-01", "2026-09-27")).toBe(true);
    expect(holdsToday("month", "2026-08-31", "2026-09-27")).toBe(false);
  });
});
