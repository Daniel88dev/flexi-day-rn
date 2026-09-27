import { en } from "@/i18n/en";
import { monthDay } from "@/test-support/attendance";

import { dayRow } from "../day-row";

const TODAY = "2026-09-27";
const HOLIDAY = { cause: "HOLIDAY", extent: "FULL", label: "St Wenceslas Day" } as const;

describe("dayRow", () => {
  it("returns worked, of required and present for an ordinary day", () => {
    const row = dayRow(monthDay(), "DAILY", TODAY, en);

    expect(row).toMatchObject({
      worked: "5:14",
      detail: "of 8:00",
      present: "5:44 present",
      hatched: false,
      toCome: false,
    });
  });

  it("returns the day's balance chip in DAILY mode", () => {
    expect(dayRow(monthDay(), "DAILY", TODAY, en).chips).toEqual([
      { kind: "balance", minutes: -166 },
    ]);
  });

  it("returns no balance chip in MONTHLY mode, where the month carries the only balance", () => {
    expect(dayRow(monthDay({ balanceMinutes: null }), "MONTHLY", TODAY, en).chips).toEqual([]);
    expect(dayRow(monthDay({ balanceMinutes: 30 }), "MONTHLY", TODAY, en).chips).toEqual([]);
  });

  it("returns no balance chip on a DAILY day the backend gives none", () => {
    expect(dayRow(monthDay({ balanceMinutes: null }), "DAILY", TODAY, en).chips).toEqual([]);
  });

  it("returns every flag of a flagged day, in the web's order", () => {
    const day = monthDay({
      businessDate: "2026-09-24",
      autoClosed: true,
      excludedClockIn: true,
      changedAfterDay: true,
      open: true,
      entered: true,
      flagged: true,
    });

    expect(dayRow(day, "MONTHLY", TODAY, en).chips).toEqual([
      { kind: "auto-closed" },
      { kind: "excluded-day" },
      { kind: "changed" },
      { kind: "still-open", overdue: true },
      { kind: "entered" },
    ]);
  });

  it("returns today's open session as a state, not an overdue flag", () => {
    const day = monthDay({ businessDate: TODAY, open: true });
    expect(dayRow(day, "MONTHLY", TODAY, en).chips).toEqual([
      { kind: "still-open", overdue: false },
    ]);
  });

  it("returns a full day off hatched, with its reason and no figure when nobody worked", () => {
    const day = monthDay({
      presenceMinutes: 0,
      workedMinutes: 0,
      requiredMinutes: 0,
      balanceMinutes: null,
      exclusion: HOLIDAY,
    });

    expect(dayRow(day, "DAILY", TODAY, en)).toMatchObject({
      worked: null,
      detail: "St Wenceslas Day",
      present: null,
      hatched: true,
      chips: [],
    });
  });

  it("returns a worked day off with its figure, its reason and the Excluded day flag", () => {
    const day = monthDay({
      presenceMinutes: 120,
      workedMinutes: 120,
      requiredMinutes: 0,
      balanceMinutes: 120,
      exclusion: { cause: "NON_WORKING_DAY", extent: "FULL", label: null },
      excludedClockIn: true,
      flagged: true,
    });

    expect(dayRow(day, "DAILY", TODAY, en)).toMatchObject({
      worked: "2:00",
      detail: "Non-working day",
      present: "2:00 present",
      hatched: true,
      chips: [{ kind: "balance", minutes: 120 }, { kind: "excluded-day" }],
    });
  });

  it("returns a half day unhatched, owing half, with the absence as a tag", () => {
    const day = monthDay({
      requiredMinutes: 240,
      exclusion: { cause: "ABSENCE", extent: "HALF", label: "SICK_DAY" },
    });

    expect(dayRow(day, "MONTHLY", TODAY, en)).toMatchObject({
      detail: "of 4:00, half day",
      hatched: false,
      chips: [{ kind: "tag", label: "Sick day ½" }],
    });
  });

  it("returns a day to come as To come, unless it is a day off", () => {
    expect(dayRow(monthDay({ upcoming: true }), "DAILY", TODAY, en).toCome).toBe(true);
    expect(
      dayRow(monthDay({ upcoming: true, exclusion: HOLIDAY }), "DAILY", TODAY, en)
    ).toMatchObject({ toCome: false, hatched: true, detail: "St Wenceslas Day" });
  });
});
