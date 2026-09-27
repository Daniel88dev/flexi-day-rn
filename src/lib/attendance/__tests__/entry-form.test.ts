import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { attendanceMonth, session } from "@/test-support/attendance";

import type { EntryDraft } from "../entry";
import {
  entryClosed,
  dayOfPickerDate,
  defaultTime,
  entryDirty,
  entryMessages,
  entryPreview,
  entrySave,
  pickerDateOfDay,
  quarterHourNow,
} from "../entry-form";

const PRAGUE = "Europe/Prague";

const draft = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  businessDate: "2026-09-08",
  startedAt: "08:10",
  endedAt: "16:55",
  nextDay: false,
  breaks: [],
  ...overrides,
});

describe("quarterHourNow", () => {
  it("returns the quarter hour just begun, in the organization's zone", () => {
    // 12:19 in Prague.
    expect(quarterHourNow(new Date("2026-09-11T10:19:00Z"), PRAGUE)).toBe("12:15");
    expect(quarterHourNow(new Date("2026-09-11T10:14:59Z"), PRAGUE)).toBe("12:00");
    expect(quarterHourNow(new Date("2026-09-11T10:45:00Z"), PRAGUE)).toBe("12:45");
  });

  it("never lands later than now, so a default end on today is never in the future", () => {
    expect(quarterHourNow(new Date("2026-09-11T10:29:59Z"), PRAGUE)).toBe("12:15");
  });

  it("reads the time in UTC when the organization names no zone", () => {
    expect(quarterHourNow(new Date("2026-09-11T23:52:00Z"), null)).toBe("23:45");
  });
});

describe("entrySave", () => {
  const ready = { draft: draft(), errors: {}, saving: false, closed: false, failure: null };

  it("returns Save enabled once both times are set and nothing is wrong", () => {
    expect(entrySave(ready)).toEqual({ enabled: true, retry: false });
  });

  it("stays disabled until start and end are both set, with no error to show for it", () => {
    expect(entrySave({ ...ready, draft: draft({ startedAt: "" }) }).enabled).toBe(false);
    expect(entrySave({ ...ready, draft: draft({ endedAt: "" }) }).enabled).toBe(false);
  });

  it("stays disabled while a field or a break is wrong", () => {
    expect(entrySave({ ...ready, errors: { endedAt: { kind: "END_BEFORE_START" } } }).enabled).toBe(
      false
    );
    expect(entrySave({ ...ready, errors: { breaks: { b1: "REQUIRED" } } }).enabled).toBe(false);
  });

  it("stays disabled while saving, and once the day has closed", () => {
    expect(entrySave({ ...ready, saving: true }).enabled).toBe(false);
    expect(entrySave({ ...ready, closed: true }).enabled).toBe(false);
  });

  it("turns into Retry after the server could not be reached or faulted", () => {
    expect(entrySave({ ...ready, failure: { kind: "network" } })).toEqual({
      enabled: true,
      retry: true,
    });
    expect(entrySave({ ...ready, failure: { kind: "server" } }).retry).toBe(true);
  });

  it("stays Save after a refusal, which the same tap would meet again", () => {
    const refusal = {
      kind: "refused" as const,
      status: 409,
      reason: "SESSION_OVERLAPS",
      ceilingMinutes: null,
      serverMessage: null,
    };
    expect(entrySave({ ...ready, failure: refusal })).toEqual({ enabled: true, retry: false });
  });
});

describe("entryDirty", () => {
  it("is false for the form as it opened", () => {
    expect(
      entryDirty(draft({ startedAt: "", endedAt: "", businessDate: "2026-09-08" }), "2026-09-08")
    ).toBe(false);
  });

  it("is true once a date, a time, the switch or a break changes", () => {
    const empty = draft({ startedAt: "", endedAt: "" });
    expect(entryDirty({ ...empty, businessDate: "2026-09-07" }, "2026-09-08")).toBe(true);
    expect(entryDirty({ ...empty, startedAt: "08:00" }, "2026-09-08")).toBe(true);
    expect(entryDirty({ ...empty, nextDay: true }, "2026-09-08")).toBe(true);
    expect(
      entryDirty({ ...empty, breaks: [{ id: "b1", startedAt: "", endedAt: "" }] }, "2026-09-08")
    ).toBe(true);
  });
});

describe("entryMessages", () => {
  it("says nothing about a field nobody has set yet", () => {
    expect(
      entryMessages(
        { startedAt: { kind: "REQUIRED" }, breaks: { b1: "REQUIRED" } },
        draft({ breaks: [{ id: "b1", startedAt: "", endedAt: "" }] }),
        en
      )
    ).toEqual({ fields: [], breaks: {} });
  });

  it("words the field errors in field order", () => {
    expect(
      entryMessages(
        {
          businessDate: { kind: "OUTSIDE_WINDOW" },
          startedAt: { kind: "OVERLAPS", from: "08:05", to: "17:10" },
          endedAt: { kind: "END_IN_FUTURE", now: "12:19" },
        },
        draft(),
        en
      ).fields
    ).toEqual([
      "Only an admin can change a day this old.",
      "Overlaps your session from 08:05 to 17:10 on this day.",
      "Can't end later than now, 12:19. Still working? Clock in, then correct the start.",
    ]);
  });

  it("names a session still running", () => {
    expect(
      entryMessages({ startedAt: { kind: "OVERLAPS", from: "17:30", to: null } }, draft(), cs)
        .fields
    ).toEqual(["Překrývá tvou směnu, která běží od 17:30."]);
  });

  it("words a day outside the employment as the backend does", () => {
    expect(
      entryMessages(
        { businessDate: { kind: "BEFORE_EMPLOYMENT", began: "2026-09-08" } },
        draft(),
        en
      ).fields
    ).toEqual(["That day is outside the employment. Pick a day inside it."]);
  });

  it("words each break's error, naming the session and the break it runs into", () => {
    const withBreaks = draft({
      breaks: [
        { id: "b1", startedAt: "12:00", endedAt: "12:30" },
        { id: "b2", startedAt: "12:20", endedAt: "12:45" },
        { id: "b3", startedAt: "18:00", endedAt: "18:30" },
        { id: "b4", startedAt: "15:30", endedAt: "15:00" },
      ],
    });

    expect(
      entryMessages(
        {
          breaks: { b2: "BREAK_OVERLAPS", b3: "BREAK_OUTSIDE_SESSION", b4: "END_BEFORE_START" },
          overlaps: { b2: "b1" },
        },
        withBreaks,
        en
      ).breaks
    ).toEqual({
      b2: "Overlaps the break from 12:00 to 12:30.",
      b3: "Has to stay inside the session, 08:10 to 16:55.",
      b4: "Has to end after it starts.",
    });
  });
});

describe("entryPreview", () => {
  const month = attendanceMonth(2026, 9, { breakMinutes: 30, breakThresholdMinutes: 360 });

  it("returns the draft's day figures from the month's break rules", () => {
    expect(
      entryPreview(draft({ breaks: [{ id: "b1", startedAt: "12:00", endedAt: "12:20" }] }), {
        timezone: PRAGUE,
        sessions: [],
        month,
      })
    ).toEqual({ presenceMinutes: 525, breaksMinutes: 20, workedMinutes: 495 });
  });

  it("counts the day's other closed sessions", () => {
    const morning = session({
      businessDate: "2026-09-08",
      startedAt: "2026-09-08T04:00:00.000Z",
      endedAt: "2026-09-08T08:00:00.000Z",
      open: false,
    });

    expect(
      entryPreview(draft({ startedAt: "13:00", endedAt: "17:00" }), {
        timezone: PRAGUE,
        sessions: [morning],
        month,
      })
    ).toEqual({ presenceMinutes: 480, breaksMinutes: 0, workedMinutes: 450 });
  });

  it("returns nothing until the month and both ends are there", () => {
    expect(entryPreview(draft(), { timezone: PRAGUE, sessions: [], month: undefined })).toBeNull();
    expect(
      entryPreview(draft({ endedAt: "" }), { timezone: PRAGUE, sessions: [], month })
    ).toBeNull();
  });
});

describe("entryClosed", () => {
  const open = {
    window: { enabled: true, days: 7 },
    active: true,
    employmentEnded: false,
    today: "2026-09-11",
    day: { businessDate: "2026-09-08", upcoming: false, exclusion: null },
  };

  it("returns null while the day takes an entry", () => {
    expect(entryClosed(open)).toBeNull();
  });

  it("names why the day stopped taking one, in the backend's reason", () => {
    expect(entryClosed({ ...open, active: false })).toBe("PLAN_LIMIT");
    expect(entryClosed({ ...open, employmentEnded: true })).toBe("EMPLOYMENT_ENDED");
    expect(entryClosed({ ...open, window: { enabled: false, days: 7 } })).toBe("SELF_SERVICE_OFF");
    expect(entryClosed({ ...open, window: undefined })).toBe("SELF_SERVICE_OFF");
    expect(
      entryClosed({
        ...open,
        day: { ...open.day, exclusion: { cause: "NOT_EMPLOYED" } },
      })
    ).toBe("OUTSIDE_EMPLOYMENT");
    expect(entryClosed({ ...open, day: { ...open.day, businessDate: "2026-09-01" } })).toBe(
      "SELF_SERVICE_WINDOW"
    );
  });
});

describe("pickerDateOfDay", () => {
  it("returns the phone's own midday on that calendar day", () => {
    const date = pickerDateOfDay("2026-03-29");
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 2, 29, 12,
    ]);
  });
});

describe("dayOfPickerDate", () => {
  it("returns the calendar day the picker shows, whatever the time on it", () => {
    expect(dayOfPickerDate(new Date(2026, 8, 7, 0, 5))).toBe("2026-09-07");
    expect(dayOfPickerDate(new Date(2026, 8, 7, 23, 55))).toBe("2026-09-07");
  });
});

describe("defaultTime", () => {
  // 12:19 on 11 September 2026 in Prague.
  const context = { now: new Date("2026-09-11T10:19:00Z"), timezone: PRAGUE, today: "2026-09-11" };
  const empty = draft({ startedAt: "", endedAt: "" });

  it("opens the start at the quarter hour already begun", () => {
    expect(defaultTime(empty, { field: "start" }, context)).toBe("12:15");
  });

  it("opens the end an hour after the start, so the two never open equal", () => {
    expect(defaultTime({ ...empty, startedAt: "08:00" }, { field: "end" }, context)).toBe("09:00");
  });

  it("keeps a default end on today no later than the quarter hour already begun", () => {
    const today = { ...empty, businessDate: "2026-09-11", startedAt: "11:45" };
    expect(defaultTime(today, { field: "end" }, context)).toBe("12:15");
  });

  it("opens the end at the quarter hour already begun while the start is empty", () => {
    expect(defaultTime(empty, { field: "end" }, context)).toBe("12:15");
  });

  it("opens a break an hour into the session, and its end half an hour later", () => {
    const day = draft({ startedAt: "08:00", endedAt: "17:00" });
    expect(defaultTime(day, { field: "break-start", breakId: "b1" }, context)).toBe("09:00");

    const withBreak = { ...day, breaks: [{ id: "b1", startedAt: "12:00", endedAt: "" }] };
    expect(defaultTime(withBreak, { field: "break-end", breakId: "b1" }, context)).toBe("12:30");
  });

  it("keeps a default break inside the session, across midnight too", () => {
    const short = draft({ startedAt: "08:00", endedAt: "08:40" });
    expect(defaultTime(short, { field: "break-start", breakId: "b1" }, context)).toBe("08:40");

    const late = { ...short, breaks: [{ id: "b1", startedAt: "08:20", endedAt: "" }] };
    expect(defaultTime(late, { field: "break-end", breakId: "b1" }, context)).toBe("08:40");

    const night = draft({
      startedAt: "22:00",
      endedAt: "06:00",
      nextDay: true,
      breaks: [{ id: "b1", startedAt: "23:45", endedAt: "" }],
    });
    expect(defaultTime(night, { field: "break-start", breakId: "b1" }, context)).toBe("23:00");
    expect(defaultTime(night, { field: "break-end", breakId: "b1" }, context)).toBe("00:15");
  });

  it("opens a break at the quarter hour already begun before the session has a start", () => {
    expect(defaultTime(empty, { field: "break-start", breakId: "b1" }, context)).toBe("12:15");
  });
});
