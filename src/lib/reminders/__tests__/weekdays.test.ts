import type {
  AttendanceExclusion,
  AttendanceMonth,
  AttendanceMonthDay,
} from "@/lib/attendance/types";

import { tickedWeekdays, toggleWeekday, workingWeekdays } from "../weekdays";

const exclusion = (cause: AttendanceExclusion["cause"]): AttendanceExclusion => ({
  cause,
  extent: "FULL",
  label: null,
});

function monthOf(days: [string, AttendanceExclusion | null][]): AttendanceMonth {
  return {
    days: days.map(
      ([businessDate, excluded]) => ({ businessDate, exclusion: excluded }) as AttendanceMonthDay
    ),
  } as AttendanceMonth;
}

// 2026-10-05 is a Monday.
const week = (overrides: Record<string, AttendanceExclusion | null> = {}) =>
  monthOf(
    ["05", "06", "07", "08", "09", "10", "11"].map((day) => {
      const date = `2026-10-${day}`;
      const weekend = day === "10" || day === "11";
      return [
        date,
        date in overrides ? overrides[date] : weekend ? exclusion("NON_WORKING_DAY") : null,
      ];
    })
  );

describe("workingWeekdays", () => {
  it("returns the weekdays the organization works, read from the months", () => {
    expect(workingWeekdays([week()])).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns a weekday a holiday or a day off fell on as worked", () => {
    const month = week({ "2026-10-06": exclusion("HOLIDAY"), "2026-10-07": exclusion("ABSENCE") });

    expect(workingWeekdays([month])).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns null while no month has answered", () => {
    expect(workingWeekdays([])).toBeNull();
  });
});

describe("tickedWeekdays", () => {
  it("returns every working day while the user picked none", () => {
    expect(tickedWeekdays(null, [1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns the user's own pick when there is one", () => {
    expect(tickedWeekdays([1, 3], [1, 2, 3, 4, 5])).toEqual([1, 3]);
  });
});

describe("toggleWeekday", () => {
  it("returns the working days less the one unticked, starting from the default", () => {
    expect(toggleWeekday(null, [1, 2, 3, 4, 5], 5)).toEqual([1, 2, 3, 4]);
  });

  it("returns the pick with the day ticked again, in order", () => {
    expect(toggleWeekday([1, 4], [1, 2, 3, 4, 5], 2)).toEqual([1, 2, 4]);
  });
});
