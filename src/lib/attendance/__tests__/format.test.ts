import {
  formatBusinessWeekday,
  formatClockTime,
  formatMinutes,
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
