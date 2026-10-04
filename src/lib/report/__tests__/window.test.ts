import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

import {
  axisLabel,
  calendarMonths,
  periodSlots,
  periodYear,
  priorYearRead,
  trailingMonths,
  windowLabel,
  withYear,
  yearsInWindow,
} from "../window";

const rolling2026 = trailingMonths(new Date(2026, 1, 16));

describe("trailingMonths", () => {
  it("returns the twelve months ending with today's, across a year boundary", () => {
    expect(rolling2026).toHaveLength(12);
    expect(rolling2026[0]).toEqual({ year: 2025, month: 3 });
    expect(rolling2026[9]).toEqual({ year: 2025, month: 12 });
    expect(rolling2026[10]).toEqual({ year: 2026, month: 1 });
    expect(rolling2026[11]).toEqual({ year: 2026, month: 2 });
  });

  it("returns one calendar year when today is in December", () => {
    expect(trailingMonths(new Date(2026, 11, 31))).toEqual(calendarMonths(2026));
  });
});

describe("calendarMonths", () => {
  it("returns January to December of the year", () => {
    const slots = calendarMonths(2025);
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({ year: 2025, month: 1 });
    expect(slots[11]).toEqual({ year: 2025, month: 12 });
  });
});

describe("periodSlots", () => {
  it("returns the trailing months for a rolling period and the calendar year for a year", () => {
    const today = new Date(2026, 9, 4);
    expect(periodSlots("rolling", today)).toEqual(trailingMonths(today));
    expect(periodSlots(2025, today)).toEqual(calendarMonths(2025));
  });
});

describe("periodYear", () => {
  it("returns this year for a rolling period and the year itself otherwise", () => {
    expect(periodYear("rolling", new Date(2026, 1, 16))).toBe(2026);
    expect(periodYear(2024, new Date(2026, 1, 16))).toBe(2024);
  });
});

describe("yearsInWindow", () => {
  it("returns each year the window touches, oldest first", () => {
    expect(yearsInWindow(rolling2026)).toEqual([2025, 2026]);
    expect(yearsInWindow(calendarMonths(2026))).toEqual([2026]);
    expect(yearsInWindow([])).toEqual([]);
  });
});

describe("priorYearRead", () => {
  it("returns a prior-year read when the window spans it and the scope lists it", () => {
    expect(priorYearRead(rolling2026, 2026, [2025, 2026])).toEqual({
      priorYear: 2025,
      spansYears: true,
      needsPrior: true,
    });
  });

  it("returns no prior-year read when the scope does not list the prior year", () => {
    expect(priorYearRead(rolling2026, 2026, [2026]).needsPrior).toBe(false);
    expect(priorYearRead(rolling2026, 2026, undefined)).toEqual({
      priorYear: 2025,
      spansYears: true,
      needsPrior: false,
    });
  });

  it("returns no prior-year read for a window inside one calendar year", () => {
    expect(priorYearRead(calendarMonths(2025), 2025, [2024, 2025])).toEqual({
      priorYear: 2024,
      spansYears: false,
      needsPrior: false,
    });
  });
});

describe("withYear", () => {
  it("returns the rows stamped with the year they were read for", () => {
    const row = {
      userId: "u-alice",
      groupId: "g-team",
      month: 3,
      vacationType: "VACATION" as const,
      used: 1,
      pending: 0,
    };
    expect(withYear(2025, [row])).toEqual([{ ...row, year: 2025 }]);
  });
});

describe("windowLabel", () => {
  it("returns the first and last month of a rolling window in English and Czech", () => {
    expect(windowLabel(rolling2026, en.calendar.monthsShort, en.report.windowRange)).toBe(
      "Mar 2025 to Feb 2026"
    );
    expect(windowLabel(rolling2026, cs.calendar.monthsShort, cs.report.windowRange)).toBe(
      "Bře 2025 až Úno 2026"
    );
  });

  it("returns the bare year for a whole calendar year", () => {
    expect(windowLabel(calendarMonths(2025), en.calendar.monthsShort, en.report.windowRange)).toBe(
      "2025"
    );
  });

  it("returns nothing for an empty window", () => {
    expect(windowLabel([], en.calendar.monthsShort, en.report.windowRange)).toBe("");
  });
});

describe("axisLabel", () => {
  it("returns a short year under the first month and each January of a two-year window", () => {
    const labels = rolling2026.map((_, index) =>
      axisLabel(rolling2026, index, en.calendar.monthsShort)
    );
    expect(labels[0]).toEqual({ month: "Mar", year: "'25" });
    expect(labels[1]).toEqual({ month: "Apr" });
    expect(labels[10]).toEqual({ month: "Jan", year: "'26" });
    expect(labels[11]).toEqual({ month: "Feb" });
  });

  it("returns bare months for a one-year window, in Czech too", () => {
    const year = calendarMonths(2026);
    expect(axisLabel(year, 0, cs.calendar.monthsShort)).toEqual({ month: "Led" });
    expect(axisLabel(year, 11, cs.calendar.monthsShort)).toEqual({ month: "Pro" });
  });

  it("returns an empty label past the window", () => {
    expect(axisLabel(rolling2026, 12, en.calendar.monthsShort)).toEqual({ month: "" });
  });
});
