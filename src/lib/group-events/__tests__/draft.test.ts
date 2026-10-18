import type { CalendarGroupEvent } from "@/lib/local-store";

import {
  blankDraft,
  createInput,
  defaultRule,
  draftFromTarget,
  draftProblem,
  editRequest,
  fitRule,
  nextDates,
  ruleChanged,
  targetOf,
  withDates,
  type GroupEventTarget,
} from "../draft";
import type { RepeatRule } from "../occurrences";

const weekly = (weekdays: number[], until: string | null = null): RepeatRule => ({
  freq: "weekly",
  interval: 1,
  weekdays,
  monthlyMode: null,
  until,
});

const STANDUP: GroupEventTarget["event"] = {
  id: "ge-1",
  groupId: "g-1",
  title: "Standup",
  note: null,
  startDate: "2026-10-05",
  endDate: "2026-10-05",
  startTime: "09:30",
  endTime: "09:45",
  repeat: weekly([0, 2]),
};

const OFFSITE: GroupEventTarget["event"] = {
  ...STANDUP,
  id: "ge-2",
  title: "Offsite",
  note: "Bring boots",
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  startTime: null,
  endTime: null,
  repeat: null,
};

const onStandup = (occurrenceDate: string): GroupEventTarget => ({
  event: STANDUP,
  occurrenceDate,
});

const occurrence = (patch: Partial<CalendarGroupEvent>): CalendarGroupEvent => ({
  id: "ge-1",
  groupId: "g-1",
  groupName: "Dev Team",
  title: "Standup",
  note: null,
  startDate: "2026-10-14",
  endDate: "2026-10-14",
  startTime: "09:30",
  endTime: "09:45",
  repeat: weekly([0, 2]),
  ruleStartDate: "2026-10-05",
  changedOnce: false,
  creator: null,
  canEdit: true,
  ...patch,
});

describe("targetOf", () => {
  it("returns a recurring group event at its own start, picked on the occurrence", () => {
    expect(targetOf(occurrence({}))).toEqual({ event: STANDUP, occurrenceDate: "2026-10-14" });
  });

  it("returns a one-off on its own dates", () => {
    expect(
      targetOf(
        occurrence({
          id: "ge-2",
          title: "Offsite",
          note: "Bring boots",
          startDate: "2026-11-02",
          endDate: "2026-11-04",
          startTime: null,
          endTime: null,
          repeat: null,
          ruleStartDate: "2026-11-02",
        })
      )
    ).toEqual({ event: OFFSITE, occurrenceDate: "2026-11-02" });
  });
});

describe("blankDraft", () => {
  it("returns an all-day, one-day group event on the date with 09:00 to 10:00 ready", () => {
    expect(blankDraft("2026-10-21", "g-1")).toEqual({
      groupId: "g-1",
      title: "",
      note: "",
      startDate: "2026-10-21",
      endDate: "2026-10-21",
      allDay: true,
      startTime: "09:00",
      endTime: "10:00",
      repeat: null,
    });
  });
});

describe("defaultRule", () => {
  it("returns a weekly rule with the start's weekday ticked", () => {
    expect(defaultRule("weekly", "2026-10-21")).toEqual(weekly([2]));
  });

  it("returns a monthly rule on the start's day", () => {
    expect(defaultRule("monthly", "2026-10-21")).toEqual({
      freq: "monthly",
      interval: 1,
      weekdays: [],
      monthlyMode: "day",
      until: null,
    });
  });
});

describe("fitRule", () => {
  it("returns a weekly rule with the start's weekday added and the days sorted", () => {
    expect(fitRule(weekly([4, 0]), "2026-10-21")).toEqual(weekly([0, 2, 4]));
  });

  it("returns the last weekday for an nth weekday started on a 5th weekday", () => {
    const rule: RepeatRule = { ...defaultRule("monthly", "2026-10-30"), monthlyMode: "weekday" };
    expect(fitRule(rule, "2026-10-30").monthlyMode).toBe("lastWeekday");
  });

  it("returns the nth weekday for a last weekday whose start is not the last", () => {
    const rule: RepeatRule = {
      ...defaultRule("monthly", "2026-10-13"),
      monthlyMode: "lastWeekday",
    };
    expect(fitRule(rule, "2026-10-13").monthlyMode).toBe("weekday");
  });
});

describe("nextDates", () => {
  it("returns the next six dates of a weekly rule from the start", () => {
    expect(nextDates("2026-10-05", weekly([0, 2]))).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-12",
      "2026-10-14",
      "2026-10-19",
      "2026-10-21",
    ]);
  });

  it("returns each month's last day for a monthly day 31", () => {
    expect(nextDates("2027-01-31", defaultRule("monthly", "2027-01-31"))).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
      "2027-05-31",
      "2027-06-30",
    ]);
  });

  it("returns fewer dates when the rule ends sooner", () => {
    const rule: RepeatRule = {
      ...defaultRule("daily", "2026-10-01"),
      interval: 3,
      until: "2026-10-10",
    };
    expect(nextDates("2026-10-01", rule)).toEqual([
      "2026-10-01",
      "2026-10-04",
      "2026-10-07",
      "2026-10-10",
    ]);
  });

  it("returns six dates of a rule repeating every 99 years", () => {
    const rule: RepeatRule = { ...defaultRule("yearly", "2026-10-21"), interval: 99 };
    expect(nextDates("2026-10-21", rule)).toHaveLength(6);
  });
});

describe("withDates", () => {
  it("returns a multi-day event with its length kept when its start moves", () => {
    const draft = { ...blankDraft("2026-11-02", "g-1"), endDate: "2026-11-04" };
    expect(withDates(draft, { startDate: "2026-11-09" })).toMatchObject({
      startDate: "2026-11-09",
      endDate: "2026-11-11",
    });
  });

  it("returns repeat off once the end passes the start", () => {
    const draft = { ...blankDraft("2026-10-21", "g-1"), repeat: weekly([2]) };
    expect(withDates(draft, { endDate: "2026-10-22" })).toMatchObject({
      endDate: "2026-10-22",
      repeat: null,
    });
  });

  it("returns an end never before the start", () => {
    const draft = blankDraft("2026-10-21", "g-1");
    expect(withDates(draft, { endDate: "2026-10-20" }).endDate).toBe("2026-10-21");
  });
});

describe("draftProblem", () => {
  const ok = { ...blankDraft("2026-10-21", "g-1"), title: "Retro" };

  it("returns null for a titled all-day draft", () => {
    expect(draftProblem(ok)).toBeNull();
  });

  it("returns title without one", () => {
    expect(draftProblem({ ...ok, title: "   " })).toBe("title");
  });

  it("returns group without one", () => {
    expect(draftProblem({ ...ok, groupId: null })).toBe("group");
  });

  it("returns endsBeforeStart for a single day that ends before it starts", () => {
    expect(draftProblem({ ...ok, allDay: false, startTime: "10:00", endTime: "10:00" })).toBe(
      "endsBeforeStart"
    );
  });

  it("returns null for a timed run of days ending earlier on the clock", () => {
    expect(
      draftProblem({
        ...ok,
        endDate: "2026-10-22",
        allDay: false,
        startTime: "16:00",
        endTime: "10:00",
      })
    ).toBeNull();
  });

  it("returns untilBeforeStart for a repeat that ends before the start", () => {
    expect(draftProblem({ ...ok, repeat: weekly([2], "2026-10-20") })).toBe("untilBeforeStart");
  });
});

describe("createInput", () => {
  it("returns an all-day draft without times and an empty note as null", () => {
    expect(createInput({ ...blankDraft("2026-10-21", "g-1"), title: "  Retro " })).toEqual({
      groupId: "g-1",
      title: "Retro",
      note: null,
      startDate: "2026-10-21",
      endDate: "2026-10-21",
      startTime: null,
      endTime: null,
      repeat: null,
    });
  });

  it("returns the times and the fitted rule of a timed weekly draft", () => {
    const draft = {
      ...blankDraft("2026-10-21", "g-1"),
      title: "Standup",
      allDay: false,
      startTime: "09:30",
      endTime: "09:45",
      repeat: weekly([0]),
    };
    expect(createInput(draft)).toMatchObject({
      startTime: "09:30",
      endTime: "09:45",
      repeat: weekly([0, 2]),
    });
  });
});

describe("draftFromTarget", () => {
  it("returns a recurring group event on the occurrence picked", () => {
    expect(draftFromTarget(onStandup("2026-10-14"))).toEqual({
      groupId: "g-1",
      title: "Standup",
      note: "",
      startDate: "2026-10-14",
      endDate: "2026-10-14",
      allDay: false,
      startTime: "09:30",
      endTime: "09:45",
      repeat: weekly([0, 2]),
    });
  });

  it("returns a one-off on its own dates with 09:00 to 10:00 ready for times", () => {
    expect(draftFromTarget({ event: OFFSITE, occurrenceDate: "2026-11-02" })).toMatchObject({
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      allDay: true,
      startTime: "09:00",
      endTime: "10:00",
      note: "Bring boots",
    });
  });
});

describe("ruleChanged", () => {
  it("returns false when only the date moves", () => {
    const draft = withDates(draftFromTarget(onStandup("2026-10-14")), {
      startDate: "2026-10-15",
    });
    expect(ruleChanged(STANDUP, draft)).toBe(false);
  });

  it("returns true when the weekdays change", () => {
    const draft = { ...draftFromTarget(onStandup("2026-10-14")), repeat: weekly([0, 2, 4]) };
    expect(ruleChanged(STANDUP, draft)).toBe(true);
  });

  it("returns true when repeat is turned off", () => {
    expect(
      ruleChanged(STANDUP, { ...draftFromTarget(onStandup("2026-10-14")), repeat: null })
    ).toBe(true);
  });
});

describe("editRequest", () => {
  it("returns a one-off's changes without a scope", () => {
    const target = { event: OFFSITE, occurrenceDate: "2026-11-02" };
    const draft = { ...draftFromTarget(target), title: "Team offsite" };
    expect(editRequest(target, draft, undefined)).toEqual({
      changes: {
        title: "Team offsite",
        note: "Bring boots",
        startDate: "2026-11-02",
        endDate: "2026-11-04",
        startTime: null,
        endTime: null,
        repeat: null,
      },
    });
  });

  it("returns one moved occurrence for this event, without the rule", () => {
    const draft = withDates(draftFromTarget(onStandup("2026-10-14")), {
      startDate: "2026-10-15",
    });
    expect(editRequest(onStandup("2026-10-14"), draft, "this")).toEqual({
      scope: "this",
      occurrenceDate: "2026-10-14",
      changes: {
        title: "Standup",
        note: null,
        startDate: "2026-10-15",
        endDate: "2026-10-15",
        startTime: "09:30",
        endTime: "09:45",
      },
    });
  });

  it("returns the new rule starting on the occurrence for this and following", () => {
    const draft = { ...draftFromTarget(onStandup("2026-10-14")), repeat: weekly([2, 4]) };
    expect(editRequest(onStandup("2026-10-14"), draft, "following")).toEqual({
      scope: "following",
      occurrenceDate: "2026-10-14",
      changes: expect.objectContaining({
        startDate: "2026-10-14",
        endDate: "2026-10-14",
        repeat: weekly([2, 4]),
      }),
    });
  });

  it("returns the first date kept for all events when the occurrence keeps its date", () => {
    const draft = { ...draftFromTarget(onStandup("2026-10-14")), title: "Daily sync" };
    expect(editRequest(onStandup("2026-10-14"), draft, "all")).toEqual({
      scope: "all",
      occurrenceDate: "2026-10-14",
      changes: {
        title: "Daily sync",
        note: null,
        startDate: "2026-10-05",
        endDate: "2026-10-05",
        startTime: "09:30",
        endTime: "09:45",
        repeat: weekly([0, 2]),
      },
    });
  });

  it("returns every date moved as far as the occurrence moved for all events", () => {
    const draft = withDates(draftFromTarget(onStandup("2026-10-14")), {
      startDate: "2026-10-15",
    });
    expect(editRequest(onStandup("2026-10-14"), draft, "all").changes).toMatchObject({
      startDate: "2026-10-06",
      endDate: "2026-10-06",
      repeat: weekly([1, 3]),
    });
  });
});
