import {
  businessDateIn,
  correctableUntil,
  entryOffered,
  parseDayLimit,
  selfServiceDaysOf,
  selfServiceMode,
  selfServiceVerdict,
  windowStart,
} from "../self-service";

const TODAY = "2026-09-11";

const verdict = (
  window: { enabled: boolean; days: number | null },
  businessDate: string,
  options: { open?: boolean; employmentEnded?: boolean } = {}
) =>
  selfServiceVerdict({
    window,
    businessDate,
    today: TODAY,
    open: options.open ?? false,
    employmentEnded: options.employmentEnded ?? false,
  });

describe("selfServiceVerdict", () => {
  it("returns OFF while the window is off, today included", () => {
    expect(verdict({ enabled: false, days: 0 }, TODAY)).toBe("OFF");
    expect(verdict({ enabled: false, days: null }, TODAY, { open: true })).toBe("OFF");
  });

  it("returns OPEN for today and N days back, OUTSIDE for the day before that", () => {
    expect(verdict({ enabled: true, days: 7 }, TODAY)).toBe("OPEN");
    expect(verdict({ enabled: true, days: 7 }, "2026-09-04")).toBe("OPEN");
    expect(verdict({ enabled: true, days: 7 }, "2026-09-03")).toBe("OUTSIDE");
    expect(verdict({ enabled: true, days: 0 }, "2026-09-10")).toBe("OUTSIDE");
  });

  it("returns OUTSIDE for a day still to come", () => {
    expect(verdict({ enabled: true, days: null }, "2026-09-12")).toBe("OUTSIDE");
  });

  it("returns OPEN for any past day with no limit", () => {
    expect(verdict({ enabled: true, days: null }, "2025-01-02")).toBe("OPEN");
  });

  it("lets a day holding an open session through while the window is on", () => {
    expect(verdict({ enabled: true, days: 0 }, "2026-09-01", { open: true })).toBe("OPEN");
  });

  it("returns ENDED for an ended Employment whatever the setting", () => {
    expect(verdict({ enabled: true, days: null }, TODAY, { employmentEnded: true })).toBe("ENDED");
    expect(verdict({ enabled: false, days: 0 }, TODAY, { employmentEnded: true })).toBe("ENDED");
  });
});

describe("windowStart", () => {
  it("returns the earliest date inside the window", () => {
    expect(windowStart(TODAY, 7)).toBe("2026-09-04");
    expect(windowStart(TODAY, 0)).toBe(TODAY);
    expect(windowStart("2026-03-02", 3)).toBe("2026-02-27");
  });

  it("returns null with no limit", () => {
    expect(windowStart(TODAY, null)).toBeNull();
  });
});

describe("correctableUntil", () => {
  it("returns the last day the window still reaches a date", () => {
    expect(correctableUntil("2026-09-09", 7)).toBe("2026-09-16");
    expect(correctableUntil("2026-09-09", 0)).toBe("2026-09-09");
  });

  it("returns null with no limit", () => {
    expect(correctableUntil("2026-09-09", null)).toBeNull();
  });
});

describe("parseDayLimit", () => {
  it("returns a whole number from 0 to 366", () => {
    expect(parseDayLimit("0")).toBe(0);
    expect(parseDayLimit(" 7 ")).toBe(7);
    expect(parseDayLimit("366")).toBe(366);
  });

  it("returns undefined for anything else", () => {
    for (const text of ["", "-1", "367", "1.5", "seven", "7d"]) {
      expect(parseDayLimit(text)).toBeUndefined();
    }
  });
});

describe("businessDateIn", () => {
  it("returns the calendar date in the zone, not UTC's", () => {
    const lateEvening = new Date("2026-09-10T22:30:00Z");
    expect(businessDateIn(lateEvening, "Europe/Prague")).toBe("2026-09-11");
    expect(businessDateIn(lateEvening, "UTC")).toBe("2026-09-10");
  });
});

describe("selfServiceMode", () => {
  it("returns OFF while switched off, whatever the days", () => {
    expect(selfServiceMode({ enabled: false, days: 7 })).toBe("OFF");
    expect(selfServiceMode({ enabled: false, days: null })).toBe("OFF");
  });

  it("returns NO_LIMIT, TODAY or DAYS while on", () => {
    expect(selfServiceMode({ enabled: true, days: null })).toBe("NO_LIMIT");
    expect(selfServiceMode({ enabled: true, days: 0 })).toBe("TODAY");
    expect(selfServiceMode({ enabled: true, days: 7 })).toBe("DAYS");
  });
});

describe("selfServiceDaysOf", () => {
  it("returns null for no limit, whatever the field holds", () => {
    expect(selfServiceDaysOf({ enabled: true, noLimit: true, days: "abc" })).toBeNull();
  });

  it("returns the typed number, or undefined when the API would refuse it", () => {
    expect(selfServiceDaysOf({ enabled: true, noLimit: false, days: "14" })).toBe(14);
    expect(selfServiceDaysOf({ enabled: true, noLimit: false, days: "400" })).toBeUndefined();
  });
});

describe("entryOffered", () => {
  const ask = (
    day: { businessDate: string; upcoming?: boolean; cause?: "NOT_EMPLOYED" | "NON_WORKING_DAY" },
    options: {
      window?: { enabled: boolean; days: number | null };
      active?: boolean;
      ended?: boolean;
    } = {}
  ) =>
    entryOffered({
      window: options.window ?? { enabled: true, days: 7 },
      today: TODAY,
      active: options.active ?? true,
      employmentEnded: options.ended ?? false,
      day: {
        businessDate: day.businessDate,
        upcoming: day.upcoming ?? false,
        exclusion: day.cause ? { cause: day.cause } : null,
      },
    });

  it("offers a day inside the window, today included, an excluded working day too", () => {
    expect(ask({ businessDate: "2026-09-04" })).toBe(true);
    expect(ask({ businessDate: TODAY })).toBe(true);
    expect(ask({ businessDate: "2026-09-05", cause: "NON_WORKING_DAY" })).toBe(true);
  });

  it("refuses a day before the window, one still to come, and one outside the employment", () => {
    expect(ask({ businessDate: "2026-09-03" })).toBe(false);
    expect(ask({ businessDate: "2026-09-12", upcoming: true })).toBe(false);
    expect(
      ask(
        { businessDate: "2026-09-01", cause: "NOT_EMPLOYED" },
        { window: { enabled: true, days: null } }
      )
    ).toBe(false);
  });

  it("refuses everything with the window off, attendance paused or the employment ended", () => {
    expect(ask({ businessDate: TODAY }, { window: { enabled: false, days: 7 } })).toBe(false);
    expect(ask({ businessDate: TODAY }, { active: false })).toBe(false);
    expect(ask({ businessDate: TODAY }, { ended: true })).toBe(false);
  });
});
