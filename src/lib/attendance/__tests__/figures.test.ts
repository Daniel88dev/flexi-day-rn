import { en } from "@/i18n/en";

import { figuresLine } from "../figures";
import type { AttendanceMonthDay } from "../types";

function day(overrides: Partial<AttendanceMonthDay> = {}): AttendanceMonthDay {
  return {
    businessDate: "2026-09-21",
    presenceMinutes: 344,
    breaksMinutes: 30,
    deductedMinutes: 30,
    workedMinutes: 314,
    requiredMinutes: 480,
    balanceMinutes: -166,
    upcoming: false,
    open: false,
    autoClosed: false,
    exclusion: null,
    excludedClockIn: false,
    entered: false,
    changedAfterDay: false,
    flagged: false,
    sessions: [],
    ...overrides,
  };
}

describe("figuresLine", () => {
  it("returns worked of required, with the day's balance in DAILY mode", () => {
    expect(figuresLine(day(), "DAILY", en)).toEqual({
      text: "Worked 5:14 of 8:00",
      balance: -166,
      tag: null,
    });
  });

  it("returns no balance in MONTHLY mode, where the month carries the only one", () => {
    expect(figuresLine(day({ balanceMinutes: null }), "MONTHLY", en).balance).toBeNull();
  });

  it("returns the reason alone for a day off nobody worked", () => {
    const holiday = day({
      presenceMinutes: 0,
      workedMinutes: 0,
      requiredMinutes: 0,
      balanceMinutes: null,
      exclusion: { cause: "HOLIDAY", extent: "FULL", label: "St Wenceslas Day" },
    });
    expect(figuresLine(holiday, "DAILY", en)).toEqual({
      text: "St Wenceslas Day",
      balance: null,
      tag: null,
    });
  });

  it("returns worked with the reason as a tag for a day off somebody worked", () => {
    const weekend = day({
      presenceMinutes: 60,
      workedMinutes: 60,
      requiredMinutes: 0,
      balanceMinutes: 60,
      exclusion: { cause: "NON_WORKING_DAY", extent: "FULL", label: null },
    });
    expect(figuresLine(weekend, "DAILY", en)).toEqual({
      text: "Worked 1:00",
      balance: 60,
      tag: "Non-working day",
    });
  });

  it("returns a half day's absence as a tag beside the halved requirement", () => {
    const half = day({
      workedMinutes: 240,
      requiredMinutes: 240,
      balanceMinutes: 0,
      exclusion: { cause: "ABSENCE", extent: "HALF", label: "VACATION" },
    });
    expect(figuresLine(half, "DAILY", en)).toEqual({
      text: "Worked 4:00 of 4:00",
      balance: 0,
      tag: "Vacation ½",
    });
  });

  it("returns a plain day off for a cause this build has never heard of", () => {
    const unknown = day({
      presenceMinutes: 0,
      exclusion: { cause: "SABBATICAL" as never, extent: "FULL", label: null },
    });
    expect(figuresLine(unknown, "DAILY", en).text).toBe("Day off");
  });
});
