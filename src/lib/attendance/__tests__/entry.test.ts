import { entryBreaks, entryErrors, entryFigures, entrySpan, type EntryDraft } from "../entry";

const PRAGUE = "Europe/Prague";

const draft = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  businessDate: "2026-09-08",
  startedAt: "08:10",
  endedAt: "16:55",
  nextDay: false,
  breaks: [],
  ...overrides,
});

// Friday 11 September 2026, 12:19 in Prague.
const now = new Date("2026-09-11T10:19:00Z");

const check = (entry: EntryDraft, overrides: Partial<Parameters<typeof entryErrors>[1]> = {}) =>
  entryErrors(entry, {
    timezone: PRAGUE,
    now,
    today: "2026-09-11",
    earliest: "2026-09-04",
    sessions: [],
    ...overrides,
  });

describe("entrySpan", () => {
  it("returns the two instants in the organization's zone", () => {
    expect(entrySpan(draft(), PRAGUE)).toEqual({
      startedAt: "2026-09-08T06:10:00.000Z",
      endedAt: "2026-09-08T14:55:00.000Z",
    });
  });

  it("puts the end on the next day when the switch is on", () => {
    expect(
      entrySpan(draft({ startedAt: "22:00", endedAt: "06:15", nextDay: true }), PRAGUE)
    ).toEqual({ startedAt: "2026-09-08T20:00:00.000Z", endedAt: "2026-09-09T04:15:00.000Z" });
  });

  it("returns null for a field that is not a time yet", () => {
    expect(entrySpan(draft({ endedAt: "" }), PRAGUE).endedAt).toBeNull();
  });
});

describe("entryErrors", () => {
  it("returns nothing for a day inside the window", () => {
    expect(check(draft())).toEqual({});
  });

  it("asks for a date and both times", () => {
    expect(check(draft({ businessDate: "", startedAt: "", endedAt: "" }))).toEqual({
      businessDate: { kind: "REQUIRED" },
      startedAt: { kind: "REQUIRED" },
      endedAt: { kind: "REQUIRED" },
    });
  });

  it("refuses a date before the window and one after today", () => {
    expect(check(draft({ businessDate: "2026-09-03" })).businessDate).toEqual({
      kind: "OUTSIDE_WINDOW",
    });
    expect(check(draft({ businessDate: "2026-09-12" })).businessDate).toEqual({
      kind: "FUTURE_DATE",
    });
  });

  it("takes any past date without a window", () => {
    expect(check(draft({ businessDate: "2026-01-05" }), { earliest: null })).toEqual({});
  });

  it("refuses an end before its start on the same day, and takes it as a night shift", () => {
    expect(check(draft({ startedAt: "16:55", endedAt: "08:10" })).endedAt).toEqual({
      kind: "END_BEFORE_START",
    });
    expect(check(draft({ startedAt: "22:00", endedAt: "06:15", nextDay: true }))).toEqual({});
  });

  it("refuses an end later than now, naming now", () => {
    expect(
      check(draft({ businessDate: "2026-09-11", startedAt: "13:00", endedAt: "17:00" })).endedAt
    ).toEqual({ kind: "END_IN_FUTURE", now: "12:19" });
  });

  it("names the session it would run over, an open one included", () => {
    const sessions = [
      { startedAt: "2026-09-08T06:05:00.000Z", endedAt: "2026-09-08T15:10:00.000Z" },
    ];

    expect(check(draft({ startedAt: "07:30", endedAt: "12:00" }), { sessions }).startedAt).toEqual({
      kind: "OVERLAPS",
      from: "08:05",
      to: "17:10",
    });
    expect(check(draft({ startedAt: "17:10", endedAt: "18:00" }), { sessions })).toEqual({});

    expect(
      check(draft({ startedAt: "18:00", endedAt: "19:00" }), {
        sessions: [{ startedAt: "2026-09-08T15:30:00.000Z", endedAt: null }],
      }).startedAt
    ).toEqual({ kind: "OVERLAPS", from: "17:30", to: null });
  });

  it("keeps the date inside the spell the team read gives away", () => {
    const spell = { began: "2026-09-08", ended: null };

    expect(
      check(draft({ businessDate: "2026-09-07" }), { earliest: null, spell }).businessDate
    ).toEqual({ kind: "BEFORE_EMPLOYMENT", began: "2026-09-08" });
    expect(check(draft(), { earliest: null, spell })).toEqual({});
    expect(
      check(draft({ businessDate: "2026-09-09" }), {
        earliest: null,
        spell: { began: null, ended: "2026-09-08" },
      }).businessDate
    ).toEqual({ kind: "AFTER_EMPLOYMENT", ended: "2026-09-08" });
  });
});

describe("entryErrors, for the breaks", () => {
  it("returns nothing for a break inside the session", () => {
    expect(check(draft({ breaks: [{ id: "b1", startedAt: "12:00", endedAt: "12:30" }] }))).toEqual(
      {}
    );
  });

  it("refuses a break outside the session, one that ends before it starts, and one with no time", () => {
    const errors = check(
      draft({
        breaks: [
          { id: "outside", startedAt: "16:45", endedAt: "17:15" },
          { id: "backwards", startedAt: "12:30", endedAt: "12:00" },
          { id: "empty", startedAt: "", endedAt: "" },
        ],
      })
    );

    expect(errors.breaks).toEqual({
      outside: "BREAK_OUTSIDE_SESSION",
      backwards: "END_BEFORE_START",
      empty: "REQUIRED",
    });
  });

  it("refuses the later of two overlapping breaks, naming the earlier", () => {
    const errors = check(
      draft({
        breaks: [
          { id: "b1", startedAt: "12:00", endedAt: "12:30" },
          { id: "b2", startedAt: "12:20", endedAt: "12:45" },
        ],
      })
    );

    expect(errors.breaks).toEqual({ b2: "BREAK_OVERLAPS" });
    expect(errors.overlaps).toEqual({ b2: "b1" });
  });

  it("reads a break after midnight as the next morning when the session ends the next day", () => {
    expect(
      check(
        draft({
          startedAt: "22:00",
          endedAt: "06:15",
          nextDay: true,
          breaks: [{ id: "b1", startedAt: "02:00", endedAt: "02:30" }],
        })
      )
    ).toEqual({});
  });
});

describe("entryBreaks", () => {
  it("returns the breaks as instants, in the order they were typed", () => {
    expect(
      entryBreaks(
        draft({
          startedAt: "22:00",
          endedAt: "06:15",
          nextDay: true,
          breaks: [
            { id: "b1", startedAt: "23:00", endedAt: "23:15" },
            { id: "b2", startedAt: "02:00", endedAt: "02:30" },
          ],
        }),
        PRAGUE
      )
    ).toEqual([
      { startedAt: "2026-09-08T21:00:00.000Z", endedAt: "2026-09-08T21:15:00.000Z" },
      { startedAt: "2026-09-09T00:00:00.000Z", endedAt: "2026-09-09T00:30:00.000Z" },
    ]);
  });
});

describe("entryFigures", () => {
  const rules = { breakMinutes: 30, breakThresholdMinutes: 360 };

  it("works the day out as a clocked one: the allowance past the threshold", () => {
    // 08:10 to 16:55 is 8:45 of presence; a 20-minute break is less than the allowance.
    expect(
      entryFigures(draft({ breaks: [{ id: "b1", startedAt: "12:00", endedAt: "12:20" }] }), {
        timezone: PRAGUE,
        sessions: [],
        rules,
      })
    ).toEqual({ presenceMinutes: 525, breaksMinutes: 20, workedMinutes: 495 });
  });

  it("deducts a break longer than the allowance in full", () => {
    expect(
      entryFigures(draft({ breaks: [{ id: "b1", startedAt: "12:00", endedAt: "12:45" }] }), {
        timezone: PRAGUE,
        sessions: [],
        rules,
      })
    ).toEqual({ presenceMinutes: 525, breaksMinutes: 45, workedMinutes: 480 });
  });

  it("deducts only the breaks taken below the threshold", () => {
    expect(
      entryFigures(
        draft({
          startedAt: "08:00",
          endedAt: "12:00",
          breaks: [{ id: "b1", startedAt: "10:00", endedAt: "10:10" }],
        }),
        { timezone: PRAGUE, sessions: [], rules }
      )
    ).toEqual({ presenceMinutes: 240, breaksMinutes: 10, workedMinutes: 230 });
  });

  it("counts the day's other sessions, since the threshold is the day's", () => {
    const morning = {
      // 06:00 to 10:00 in Prague, with a 15-minute break.
      startedAt: "2026-09-08T04:00:00.000Z",
      endedAt: "2026-09-08T08:00:00.000Z",
      breaks: [{ startedAt: "2026-09-08T06:00:00.000Z", endedAt: "2026-09-08T06:15:00.000Z" }],
    };

    expect(
      entryFigures(draft({ startedAt: "13:00", endedAt: "17:00" }), {
        timezone: PRAGUE,
        sessions: [morning],
        rules,
      })
    ).toEqual({ presenceMinutes: 480, breaksMinutes: 15, workedMinutes: 450 });
  });

  it("leaves out a break the form still refuses", () => {
    expect(
      entryFigures(draft({ breaks: [{ id: "b1", startedAt: "18:00", endedAt: "18:30" }] }), {
        timezone: PRAGUE,
        sessions: [],
        rules,
      })?.breaksMinutes
    ).toBe(0);
  });

  it("has nothing to say until both ends are times", () => {
    expect(
      entryFigures(draft({ endedAt: "" }), { timezone: PRAGUE, sessions: [], rules })
    ).toBeNull();
  });
});
