import {
  breakErrors,
  correctionErrors,
  draftEdited,
  filledSpans,
  resolveBreaks,
  instantAt,
  sessionDraft,
  timeFieldOf,
  toBreakPatch,
  toNewBreaks,
  toPatch,
  type SessionDraft,
} from "../correction";
import type { AttendanceBreak, AttendanceSession } from "../types";

const PRAGUE = "Europe/Prague";

const session = (overrides: Partial<AttendanceSession> = {}): AttendanceSession => ({
  id: "session-1",
  businessDate: "2026-09-09",
  // 08:05 and 17:10 in Prague, which is UTC+2 in September.
  startedAt: "2026-09-09T06:05:00.000Z",
  endedAt: "2026-09-09T15:10:00.000Z",
  timezone: PRAGUE,
  closedBy: "USER",
  open: false,
  startLatitude: null,
  startLongitude: null,
  startAccuracy: null,
  endLatitude: null,
  endLongitude: null,
  endAccuracy: null,
  breaks: [],
  ...overrides,
});

describe("timeFieldOf", () => {
  it("reads an instant as HH:mm in the organization's zone", () => {
    expect(timeFieldOf("2026-09-09T06:05:00.000Z", PRAGUE)).toBe("08:05");
  });

  it("is empty for an end that has not happened", () => {
    expect(timeFieldOf(null, PRAGUE)).toBe("");
  });
});

describe("instantAt", () => {
  it("reads a time as the organization's, not the browser's", () => {
    expect(instantAt("2026-09-09", "08:05", PRAGUE)).toBe("2026-09-09T06:05:00.000Z");
  });

  it("follows the zone across a daylight-saving change", () => {
    // Prague is UTC+1 in December and UTC+2 in September.
    expect(instantAt("2026-12-09", "08:05", PRAGUE)).toBe("2026-12-09T07:05:00.000Z");
  });

  it("answers null for a half-typed time", () => {
    expect(instantAt("2026-09-09", "", PRAGUE)).toBeNull();
    expect(instantAt("2026-09-09", "8:", PRAGUE)).toBeNull();
  });
});

describe("sessionDraft", () => {
  it("opens on the times as they stand", () => {
    const draft = sessionDraft(
      session({
        breaks: [
          {
            id: "break-1",
            sessionId: "session-1",
            startedAt: "2026-09-09T10:00:00.000Z",
            endedAt: "2026-09-09T10:30:00.000Z",
            autoClosed: false,
            open: false,
          },
        ],
      }),
      PRAGUE
    );

    expect(draft.startedAt).toBe("08:05");
    expect(draft.endedAt).toBe("17:10");
    expect(draft.breaks).toEqual([{ id: "break-1", startedAt: "12:00", endedAt: "12:30" }]);
  });
});

describe("toPatch", () => {
  const draft = (overrides: Partial<SessionDraft> = {}): SessionDraft => ({
    ...sessionDraft(session(), PRAGUE),
    ...overrides,
  });

  it("sends nothing when nothing moved", () => {
    expect(toPatch(session(), draft(), PRAGUE)).toBeNull();
  });

  it("sends only the end that moved", () => {
    expect(toPatch(session(), draft({ endedAt: "17:30" }), PRAGUE)).toEqual({
      endedAt: "2026-09-09T15:30:00.000Z",
    });
  });

  it("reads a clock-out earlier in the day than the clock-in as the next day", () => {
    // The sweep's 00:05 is Thursday, so typing 02:00 means Thursday too.
    const patch = toPatch(session(), draft({ endedAt: "02:00" }), PRAGUE);

    expect(patch).toEqual({ endedAt: "2026-09-10T00:00:00.000Z" });
  });

  it("brings a clock-out the sweep put after midnight back onto its own day", () => {
    const swept = session({ endedAt: "2026-09-09T22:05:00.000Z", closedBy: "SWEEP" });

    expect(toPatch(swept, draft({ endedAt: "17:10" }), PRAGUE)).toEqual({
      endedAt: "2026-09-09T15:10:00.000Z",
    });
  });

  it("clears the end when the field is emptied", () => {
    expect(toPatch(session(), draft({ endedAt: "" }), PRAGUE)).toEqual({ endedAt: null });
  });
});

describe("correctionErrors", () => {
  const withBreak = (startedAt: string, endedAt: string) =>
    correctionErrors(
      {
        startedAt: "08:05",
        endedAt: "17:10",
        breaks: [{ id: "break-1", startedAt, endedAt }],
      },
      "2026-09-09",
      PRAGUE
    );

  it("passes a day that makes sense", () => {
    expect(withBreak("12:00", "12:30")).toEqual({});
  });

  it("refuses a clock-out at its clock-in", () => {
    const errors = correctionErrors(
      { startedAt: "08:05", endedAt: "08:05", breaks: [] },
      "2026-09-09",
      PRAGUE
    );

    expect(errors.endedAt).toBe("END_BEFORE_START");
  });

  it("refuses a break that ends before it starts", () => {
    expect(withBreak("12:30", "12:00").breaks?.["break-1"]).toBe("END_BEFORE_START");
  });

  it("refuses a break outside its session", () => {
    expect(withBreak("07:00", "07:30").breaks?.["break-1"]).toBe("BREAK_OUTSIDE_SESSION");
    expect(withBreak("18:00", "18:30").breaks?.["break-1"]).toBe("BREAK_OUTSIDE_SESSION");
  });

  it("refuses a clock-in nobody typed", () => {
    expect(
      correctionErrors({ startedAt: "", endedAt: "17:10", breaks: [] }, "2026-09-09", PRAGUE)
        .startedAt
    ).toBe("REQUIRED");
  });

  it("refuses the later of two breaks that overlap, naming the earlier one", () => {
    const errors = correctionErrors(
      {
        startedAt: "08:05",
        endedAt: "17:10",
        breaks: [
          { id: "break-1", startedAt: "12:00", endedAt: "12:30" },
          { id: "new-1", startedAt: "12:20", endedAt: "12:45", isNew: true },
        ],
      },
      "2026-09-09",
      PRAGUE
    );

    expect(errors.breaks).toEqual({ "new-1": "BREAK_OVERLAPS" });
    expect(errors.overlaps).toEqual({ "new-1": "break-1" });
  });

  it("lets two breaks sit back to back", () => {
    const errors = correctionErrors(
      {
        startedAt: "08:05",
        endedAt: "17:10",
        breaks: [
          { id: "break-1", startedAt: "12:00", endedAt: "12:30" },
          { id: "new-1", startedAt: "12:30", endedAt: "12:45", isNew: true },
        ],
      },
      "2026-09-09",
      PRAGUE
    );

    expect(errors).toEqual({});
  });

  it("asks for a time on a new break nobody has filled in", () => {
    const errors = correctionErrors(
      {
        startedAt: "08:05",
        endedAt: "17:10",
        breaks: [{ id: "new-1", startedAt: "", endedAt: "", isNew: true }],
      },
      "2026-09-09",
      PRAGUE
    );

    expect(errors.breaks).toEqual({ "new-1": "REQUIRED" });
  });

  it("takes an empty clock-out as a session still running", () => {
    expect(
      correctionErrors({ startedAt: "08:05", endedAt: "", breaks: [] }, "2026-09-09", PRAGUE)
    ).toEqual({});
  });
});

describe("toBreakPatch", () => {
  const entry: AttendanceBreak = {
    id: "break-1",
    sessionId: "session-1",
    // 12:00 to 12:30 in Prague.
    startedAt: "2026-09-09T10:00:00.000Z",
    endedAt: "2026-09-09T10:30:00.000Z",
    autoClosed: false,
    open: false,
  };

  const draft = (startedAt: string, endedAt: string): SessionDraft => ({
    startedAt: "08:05",
    endedAt: "17:10",
    breaks: [{ id: "break-1", startedAt, endedAt }],
  });

  it("sends nothing when the break did not move", () => {
    expect(toBreakPatch(entry, draft("12:00", "12:30"), "2026-09-09", PRAGUE)).toBeNull();
  });

  it("sends only the end that moved", () => {
    expect(toBreakPatch(entry, draft("12:00", "12:45"), "2026-09-09", PRAGUE)).toEqual({
      endedAt: "2026-09-09T10:45:00.000Z",
    });
  });

  it("sends both ends when both moved", () => {
    expect(toBreakPatch(entry, draft("11:30", "12:15"), "2026-09-09", PRAGUE)).toEqual({
      startedAt: "2026-09-09T09:30:00.000Z",
      endedAt: "2026-09-09T10:15:00.000Z",
    });
  });

  it("reopens a break whose end was cleared", () => {
    expect(toBreakPatch(entry, draft("12:00", ""), "2026-09-09", PRAGUE)).toEqual({
      endedAt: null,
    });
  });

  it("carries a break past midnight only inside a session that crosses it", () => {
    const overnight: SessionDraft = {
      startedAt: "22:00",
      endedAt: "06:00",
      breaks: [{ id: "break-1", startedAt: "01:00", endedAt: "01:30" }],
    };

    expect(toBreakPatch(entry, overnight, "2026-09-09", PRAGUE)).toEqual({
      startedAt: "2026-09-09T23:00:00.000Z",
      endedAt: "2026-09-09T23:30:00.000Z",
    });
  });

  it("ignores a break the draft has no field for", () => {
    const other: AttendanceBreak = { ...entry, id: "break-2" };

    expect(toBreakPatch(other, draft("12:00", "12:45"), "2026-09-09", PRAGUE)).toBeNull();
  });
});

describe("toNewBreaks", () => {
  it("returns the new breaks as instants and leaves the recorded ones to their patches", () => {
    const draft: SessionDraft = {
      startedAt: "08:05",
      endedAt: "17:10",
      breaks: [
        { id: "break-1", startedAt: "12:00", endedAt: "12:30" },
        { id: "new-1", startedAt: "15:00", endedAt: "15:20", isNew: true },
      ],
    };

    expect(toNewBreaks(draft, "2026-09-09", PRAGUE)).toEqual([
      {
        id: "new-1",
        span: { startedAt: "2026-09-09T13:00:00.000Z", endedAt: "2026-09-09T13:20:00.000Z" },
      },
    ]);
  });

  it("carries a new break past midnight inside a session that crosses it", () => {
    const draft: SessionDraft = {
      startedAt: "22:00",
      endedAt: "06:00",
      breaks: [{ id: "new-1", startedAt: "02:00", endedAt: "02:30", isNew: true }],
    };

    expect(toNewBreaks(draft, "2026-09-09", PRAGUE)).toEqual([
      {
        id: "new-1",
        span: { startedAt: "2026-09-10T00:00:00.000Z", endedAt: "2026-09-10T00:30:00.000Z" },
      },
    ]);
  });
});

describe("resolveBreaks", () => {
  const day = { startedAt: "2026-09-09T06:05:00.000Z", endedAt: "2026-09-09T15:10:00.000Z" };
  const night = { startedAt: "2026-09-09T20:00:00.000Z", endedAt: "2026-09-10T04:00:00.000Z" };

  it("reads break times on the business date in the organization's zone", () => {
    expect(
      resolveBreaks([{ id: "b1", startedAt: "12:00", endedAt: "12:30" }], "2026-09-09", day, PRAGUE)
    ).toEqual([
      { id: "b1", startedAt: "2026-09-09T10:00:00.000Z", endedAt: "2026-09-09T10:30:00.000Z" },
    ]);
  });

  it("keeps a time before the start on the same day inside an ordinary session", () => {
    expect(
      resolveBreaks([{ id: "b1", startedAt: "07:00", endedAt: "07:30" }], "2026-09-09", day, PRAGUE)
    ).toEqual([
      { id: "b1", startedAt: "2026-09-09T05:00:00.000Z", endedAt: "2026-09-09T05:30:00.000Z" },
    ]);
  });

  it("moves a time before the start to the next morning inside a session crossing midnight", () => {
    expect(
      resolveBreaks(
        [{ id: "b1", startedAt: "02:00", endedAt: "02:30" }],
        "2026-09-09",
        night,
        PRAGUE
      )
    ).toEqual([
      { id: "b1", startedAt: "2026-09-10T00:00:00.000Z", endedAt: "2026-09-10T00:30:00.000Z" },
    ]);
  });

  it("leaves a half-typed time null", () => {
    expect(
      resolveBreaks([{ id: "b1", startedAt: "12:00", endedAt: "" }], "2026-09-09", day, PRAGUE)[0]
        ?.endedAt
    ).toBeNull();
  });
});

describe("breakErrors", () => {
  const session = { startedAt: "2026-09-09T06:00:00.000Z", endedAt: "2026-09-09T15:00:00.000Z" };
  const span = (id: string, startedAt: string | null, endedAt: string | null) => ({
    id,
    startedAt: startedAt === null ? null : `2026-09-09T${startedAt}:00.000Z`,
    endedAt: endedAt === null ? null : `2026-09-09T${endedAt}:00.000Z`,
  });

  it("returns nothing for breaks inside the session, back to back included", () => {
    expect(
      breakErrors([span("b1", "10:00", "10:30"), span("b2", "10:30", "10:45")], session)
    ).toEqual({});
  });

  it("names each rule a break breaks", () => {
    expect(
      breakErrors(
        [
          span("empty", null, "10:00"),
          span("backwards", "11:00", "10:30"),
          span("outside", "14:50", "15:20"),
        ],
        session
      )
    ).toEqual({
      breaks: {
        empty: "REQUIRED",
        backwards: "END_BEFORE_START",
        outside: "BREAK_OUTSIDE_SESSION",
      },
    });
  });

  it("puts an overlap on the later break and names the earlier one", () => {
    expect(
      breakErrors([span("b1", "10:00", "10:30"), span("b2", "10:15", "10:45")], session)
    ).toEqual({ breaks: { b2: "BREAK_OVERLAPS" }, overlaps: { b2: "b1" } });
  });

  it("does not hold a refused break against the others", () => {
    expect(
      breakErrors([span("outside", "05:00", "10:30"), span("b2", "10:00", "10:15")], session)
    ).toEqual({ breaks: { outside: "BREAK_OUTSIDE_SESSION" } });
  });
});

describe("filledSpans", () => {
  it("keeps the breaks with both times, without their ids", () => {
    expect(
      filledSpans([
        { id: "b1", startedAt: "2026-09-09T10:00:00.000Z", endedAt: "2026-09-09T10:30:00.000Z" },
        { id: "b2", startedAt: "2026-09-09T11:00:00.000Z", endedAt: null },
      ])
    ).toEqual([{ startedAt: "2026-09-09T10:00:00.000Z", endedAt: "2026-09-09T10:30:00.000Z" }]);
  });
});

describe("draftEdited", () => {
  const lunch: AttendanceBreak = {
    id: "break-1",
    sessionId: "session-1",
    startedAt: "2026-09-09T10:00:00.000Z",
    endedAt: "2026-09-09T10:30:00.000Z",
    autoClosed: false,
    open: false,
  };
  const saved = session({ breaks: [lunch] });

  it("is false for the draft the session opens on", () => {
    expect(draftEdited(saved, sessionDraft(saved, PRAGUE), PRAGUE)).toBe(false);
  });

  it("is true once a clock-in or clock-out is changed", () => {
    const draft = sessionDraft(saved, PRAGUE);

    expect(draftEdited(saved, { ...draft, startedAt: "08:00" }, PRAGUE)).toBe(true);
    expect(draftEdited(saved, { ...draft, endedAt: "" }, PRAGUE)).toBe(true);
  });

  it("is true once a break is moved or a new one is added", () => {
    const draft = sessionDraft(saved, PRAGUE);

    expect(
      draftEdited(
        saved,
        { ...draft, breaks: [{ id: "break-1", startedAt: "12:00", endedAt: "12:45" }] },
        PRAGUE
      )
    ).toBe(true);
    expect(
      draftEdited(
        saved,
        {
          ...draft,
          breaks: [...draft.breaks, { id: "new-1", startedAt: "", endedAt: "", isNew: true }],
        },
        PRAGUE
      )
    ).toBe(true);
  });
});
