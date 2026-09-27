import { en } from "@/i18n/en";
import { attendanceMonth, monthDay } from "@/test-support/attendance";

import { monthStats, weekStats } from "../stats";

const TOTALS = {
  presenceMinutes: 6000,
  workedMinutes: 5520,
  requiredMinutes: 5760,
  requiredRangeMinutes: 10560,
  balanceMinutes: -240,
  flaggedDays: 2,
  excludedDays: 9,
};

const notEmployed = { cause: "NOT_EMPLOYED", extent: "FULL", label: null } as const;

describe("monthStats", () => {
  it("returns Balance and Flagged in DAILY mode", () => {
    const month = attendanceMonth(2026, 9, { balanceMode: "DAILY", totals: TOTALS });

    expect(monthStats(month, en)).toEqual([
      { label: "Worked", value: "92:00" },
      { label: "Required so far", value: "96:00" },
      { label: "Balance", value: "-4:00", sub: "against required to date" },
      { label: "Flagged", value: "2", sub: "days to check" },
      { label: "Excluded days", value: "9", sub: "of 30" },
    ]);
  });

  it("returns Month balance and Month required in MONTHLY mode", () => {
    const month = attendanceMonth(2026, 9, { balanceMode: "MONTHLY", totals: TOTALS });

    expect(monthStats(month, en).map((stat) => [stat.label, stat.value])).toEqual([
      ["Worked", "92:00"],
      ["Required so far", "96:00"],
      ["Month balance", "-4:00"],
      ["Month required", "176:00"],
      ["Excluded days", "9"],
    ]);
  });

  it("returns excluded days of the days this Employment was there to work", () => {
    const before = Object.fromEntries(
      Array.from({ length: 14 }, (_, index) => [
        `2026-09-${String(index + 1).padStart(2, "0")}`,
        { exclusion: notEmployed },
      ])
    );
    const month = attendanceMonth(2026, 9, { totals: TOTALS }, before);

    expect(monthStats(month, en).at(-1)).toEqual({
      label: "Excluded days",
      value: "9",
      sub: "of 16",
    });
  });
});

describe("weekStats", () => {
  it("returns the begun days' worked against their required, and every flagged day", () => {
    const days = [
      monthDay({ businessDate: "2026-09-24", workedMinutes: 500, requiredMinutes: 480 }),
      monthDay({
        businessDate: "2026-09-25",
        workedMinutes: 400,
        requiredMinutes: 480,
        flagged: true,
      }),
      monthDay({
        businessDate: "2026-09-28",
        workedMinutes: 0,
        requiredMinutes: 480,
        upcoming: true,
      }),
    ];

    expect(weekStats(days, en)).toEqual([
      { label: "Worked", value: "15:00" },
      { label: "Required", value: "16:00" },
      { label: "Balance", value: "-1:00" },
      { label: "Flagged", value: "1", sub: "day to check" },
    ]);
  });
});
