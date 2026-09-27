import {
  formatBusinessDay,
  formatBusinessWeekday,
  formatClockTime,
  formatMinutes,
  formatRangeLabel,
  formatRowDay,
  formatSignedMinutes,
  formatTimer,
  formatWeekday,
} from "@/lib/attendance/format";

describe("formatMinutes", () => {
  it("returns h:mm", () => {
    expect(formatMinutes(107)).toBe("1:47");
    expect(formatMinutes(0)).toBe("0:00");
  });
});

describe("formatTimer", () => {
  it("returns m:ss under an hour", () => {
    expect(formatTimer(7 * 60_000 + 5_000)).toBe("7:05");
  });

  it("returns h:mm:ss from an hour on", () => {
    expect(formatTimer(3 * 3_600_000 + 47 * 60_000 + 12_000)).toBe("3:47:12");
  });

  it("returns 0:00 for a start a skewed phone clock puts in the future", () => {
    expect(formatTimer(-4_000)).toBe("0:00");
  });
});

describe("formatClockTime", () => {
  it("returns HH:MM in the organization's zone rather than the phone's", () => {
    expect(formatClockTime("2026-09-27T06:05:00.000Z", "Europe/Prague")).toBe("08:05");
  });

  it("returns HH:MM in the phone's zone when the organization names none", () => {
    expect(formatClockTime("2026-09-27T06:05:00.000Z", null)).toMatch(/^\d\d:05$/);
  });
});

describe("formatBusinessWeekday", () => {
  it("returns the business date's weekday, capitalised, in the phone's language", () => {
    expect(formatBusinessWeekday("2026-09-24", "en")).toBe("Thursday");
    expect(formatBusinessWeekday("2026-09-24", "cs")).toBe("Čtvrtek");
  });
});

describe("formatWeekday", () => {
  it("returns an instant's weekday in the organization's zone, capitalised", () => {
    // 23:30 UTC on Thursday is already Friday in Prague.
    expect(formatWeekday("2026-09-24T23:30:00.000Z", "en", "Europe/Prague")).toBe("Friday");
    expect(formatWeekday("2026-09-24T23:30:00.000Z", "cs", "Europe/Prague")).toBe("Pátek");
  });
});

describe("formatSignedMinutes", () => {
  it("returns a balance with its sign, and a bare zero", () => {
    expect(formatSignedMinutes(11)).toBe("+0:11");
    expect(formatSignedMinutes(-85)).toBe("-1:25");
    expect(formatSignedMinutes(0)).toBe("0:00");
  });
});

describe("formatBusinessDay", () => {
  it("returns the weekday, day and month of a business date, whatever the device's zone", () => {
    expect(formatBusinessDay("2026-09-27", "en")).toBe("Sunday, September 27");
    expect(formatBusinessDay("2026-09-27", "cs")).toBe("Neděle 27. září");
  });

  it("returns the input for something that is no date", () => {
    expect(formatBusinessDay("nope", "en")).toBe("nope");
  });
});

describe("formatRangeLabel", () => {
  it("returns a week as its Monday and Sunday", () => {
    expect(formatRangeLabel("week", "2026-09-24", "en")).toBe("Sep 21 - Sep 27");
    expect(formatRangeLabel("week", "2026-10-01", "en")).toBe("Sep 28 - Oct 4");
  });

  it("returns a month with its year, capitalised", () => {
    expect(formatRangeLabel("month", "2026-09-24", "en")).toBe("September 2026");
    expect(formatRangeLabel("month", "2026-09-24", "cs")).toBe("Září 2026");
  });
});

describe("formatRowDay", () => {
  it("returns a business date's short weekday and its day and month", () => {
    expect(formatRowDay("2026-09-27", "en")).toEqual({ weekday: "Sun", date: "Sep 27" });
  });
});
