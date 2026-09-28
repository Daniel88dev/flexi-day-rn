import { attendance, pause, session } from "@/test-support/attendance";

import {
  correctionClosed,
  correctionSave,
  correctionSheetErrors,
  correctionSteps,
  flagsOnSave,
  heldDraft,
  heldEdited,
  rebaseDraft,
  runCorrection,
  sessionDeletable,
  settleDraft,
  withBreakAdded,
  withBreakChanged,
  withBreakRemoved,
  withBreakRestored,
  type CorrectionStep,
} from "../correction-sheet";

const PRAGUE = "Europe/Prague";

// 08:00 to 16:00 in Prague on 24 September, with a 12:00 to 12:30 break.
const closed = session({
  id: "s1",
  businessDate: "2026-09-24",
  startedAt: "2026-09-24T06:00:00.000Z",
  endedAt: "2026-09-24T14:00:00.000Z",
  closedBy: "USER",
  open: false,
  breaks: [
    pause({
      id: "lunch",
      startedAt: "2026-09-24T10:00:00.000Z",
      endedAt: "2026-09-24T10:30:00.000Z",
      open: false,
    }),
  ],
});

describe("heldDraft", () => {
  it("reads the session's times and breaks as the organization's HH:mm", () => {
    expect(heldDraft(closed, PRAGUE)).toEqual({
      startedAt: "08:00",
      endedAt: "16:00",
      breaks: [{ id: "lunch", startedAt: "12:00", endedAt: "12:30", running: false }],
    });
  });

  it("marks a break still running and leaves the session's end empty while it runs", () => {
    const running = session({
      startedAt: "2026-09-24T06:00:00.000Z",
      endedAt: null,
      breaks: [pause({ id: "now", startedAt: "2026-09-24T10:00:00.000Z", endedAt: null })],
    });

    expect(heldDraft(running, PRAGUE)).toEqual({
      startedAt: "08:00",
      endedAt: "",
      breaks: [{ id: "now", startedAt: "12:00", endedAt: "", running: true }],
    });
  });
});

describe("withBreakRemoved", () => {
  it("holds a saved break as removed rather than dropping it", () => {
    const draft = withBreakRemoved(heldDraft(closed, PRAGUE), "lunch");

    expect(draft.breaks).toEqual([
      { id: "lunch", startedAt: "12:00", endedAt: "12:30", running: false, removed: true },
    ]);
    expect(heldEdited(closed, draft, PRAGUE)).toBe(true);
  });

  it("drops a break that was only added in the sheet", () => {
    const added = withBreakAdded(heldDraft(closed, PRAGUE));

    expect(withBreakRemoved(added, "new-1").breaks.map((entry) => entry.id)).toEqual(["lunch"]);
  });
});

describe("withBreakRestored", () => {
  it("undoes a removal, leaving the draft as the session stands", () => {
    const draft = withBreakRestored(withBreakRemoved(heldDraft(closed, PRAGUE), "lunch"), "lunch");

    expect(draft).toEqual(heldDraft(closed, PRAGUE));
    expect(heldEdited(closed, draft, PRAGUE)).toBe(false);
  });
});

describe("withBreakAdded", () => {
  it("numbers a new break after the ones the draft already holds", () => {
    const twice = withBreakAdded(withBreakAdded(heldDraft(closed, PRAGUE)));

    expect(twice.breaks.map((entry) => entry.id)).toEqual(["lunch", "new-1", "new-2"]);
    expect(withBreakAdded(withBreakRemoved(twice, "new-1")).breaks.at(-1)?.id).toBe("new-3");
  });

  it("appends an empty new break", () => {
    const draft = withBreakAdded(heldDraft(closed, PRAGUE));

    expect(draft.breaks.at(-1)).toEqual({ id: "new-1", startedAt: "", endedAt: "", isNew: true });
    expect(heldEdited(closed, draft, PRAGUE)).toBe(true);
  });
});

describe("withBreakChanged", () => {
  it("moves one break and nothing else", () => {
    const draft = withBreakChanged(heldDraft(closed, PRAGUE), "lunch", { startedAt: "12:15" });

    expect(draft.breaks[0]).toMatchObject({ startedAt: "12:15", endedAt: "12:30" });
    expect(heldEdited(closed, draft, PRAGUE)).toBe(true);
  });
});

describe("heldEdited", () => {
  it("is false for the draft as the session stands", () => {
    expect(heldEdited(closed, heldDraft(closed, PRAGUE), PRAGUE)).toBe(false);
  });

  it("is true once the start moved", () => {
    expect(heldEdited(closed, { ...heldDraft(closed, PRAGUE), startedAt: "07:45" }, PRAGUE)).toBe(
      true
    );
  });
});

// A second break at 14:00 to 14:15, beside the lunch.
const twoBreaks = session({
  ...closed,
  breaks: [
    ...closed.breaks,
    pause({
      id: "coffee",
      startedAt: "2026-09-24T12:00:00.000Z",
      endedAt: "2026-09-24T12:15:00.000Z",
      open: false,
    }),
  ],
});

describe("correctionSteps", () => {
  it("is empty while nothing changed", () => {
    expect(correctionSteps(twoBreaks, heldDraft(twoBreaks, PRAGUE), PRAGUE)).toEqual([]);
  });

  it("deletes first, then patches the widened session before its breaks, then adds", () => {
    let draft = withBreakRemoved(heldDraft(twoBreaks, PRAGUE), "coffee");
    draft = withBreakChanged(draft, "lunch", { startedAt: "12:15", endedAt: "12:45" });
    draft = withBreakAdded({ ...draft, endedAt: "17:00" });
    draft = withBreakChanged(draft, "new-1", { startedAt: "15:00", endedAt: "15:10" });

    expect(correctionSteps(twoBreaks, draft, PRAGUE)).toEqual([
      { kind: "delete-break", breakId: "coffee" },
      { kind: "patch-session", sessionId: "s1", patch: { endedAt: "2026-09-24T15:00:00.000Z" } },
      {
        kind: "patch-break",
        breakId: "lunch",
        patch: { startedAt: "2026-09-24T10:15:00.000Z", endedAt: "2026-09-24T10:45:00.000Z" },
      },
      {
        kind: "add-break",
        sessionId: "s1",
        draftId: "new-1",
        span: { startedAt: "2026-09-24T13:00:00.000Z", endedAt: "2026-09-24T13:10:00.000Z" },
      },
    ]);
  });

  it("moves the breaks in before the session when the session narrows", () => {
    const draft = withBreakChanged(
      { ...heldDraft(twoBreaks, PRAGUE), endedAt: "14:00" },
      "coffee",
      { startedAt: "13:30", endedAt: "13:45" }
    );

    expect(correctionSteps(twoBreaks, draft, PRAGUE).map((step) => step.kind)).toEqual([
      "patch-break",
      "patch-session",
    ]);
  });

  it("narrows from the start too", () => {
    const draft = withBreakChanged(
      { ...heldDraft(twoBreaks, PRAGUE), startedAt: "12:10" },
      "lunch",
      { startedAt: "12:20", endedAt: "12:40" }
    );

    expect(correctionSteps(twoBreaks, draft, PRAGUE).map((step) => step.kind)).toEqual([
      "patch-break",
      "patch-session",
    ]);
  });

  it("does not delete a removed break the server no longer has", () => {
    const draft = withBreakRemoved(heldDraft(twoBreaks, PRAGUE), "coffee");

    expect(correctionSteps(closed, draft, PRAGUE)).toEqual([]);
  });

  it("sends only the start of a session still running", () => {
    const running = session({
      id: "s1",
      businessDate: "2026-09-24",
      startedAt: "2026-09-24T06:00:00.000Z",
      endedAt: null,
    });

    expect(
      correctionSteps(running, { ...heldDraft(running, PRAGUE), startedAt: "07:30" }, PRAGUE)
    ).toEqual([
      { kind: "patch-session", sessionId: "s1", patch: { startedAt: "2026-09-24T05:30:00.000Z" } },
    ]);
  });
});

describe("runCorrection", () => {
  const steps: CorrectionStep[] = [
    { kind: "delete-break", breakId: "coffee" },
    { kind: "patch-session", sessionId: "s1", patch: { endedAt: "2026-09-24T15:00:00.000Z" } },
    {
      kind: "add-break",
      sessionId: "s1",
      draftId: "new-1",
      span: { startedAt: "2026-09-24T13:00:00.000Z", endedAt: "2026-09-24T13:10:00.000Z" },
    },
  ];

  it("sends every step in order and reports each as landed", async () => {
    const sent: string[] = [];
    const result = await runCorrection(steps, async (step) => {
      sent.push(step.kind);
      return closed;
    });

    expect(sent).toEqual(["delete-break", "patch-session", "add-break"]);
    expect(result.failure).toBeNull();
    expect(result.landed.map((entry) => entry.step.kind)).toEqual(sent);
  });

  it("stops at the first failure and sends nothing after it", async () => {
    const offline = new TypeError("Network request failed");
    const sent: string[] = [];
    const result = await runCorrection(steps, async (step) => {
      sent.push(step.kind);
      if (step.kind === "patch-session") throw offline;
      return closed;
    });

    expect(sent).toEqual(["delete-break", "patch-session"]);
    expect(result.failure).toBe(offline);
    expect(result.landed.map((entry) => entry.step.kind)).toEqual(["delete-break"]);
  });
});

describe("settleDraft", () => {
  // Coffee removed, and two breaks added at 15:00 and 15:20 for ten minutes each.
  const draft = () => {
    let next = withBreakRemoved(heldDraft(twoBreaks, PRAGUE), "coffee");
    next = withBreakAdded(next);
    next = withBreakChanged(next, "new-1", { startedAt: "15:00", endedAt: "15:10" });
    next = withBreakAdded(next);
    return withBreakChanged(next, "new-2", { startedAt: "15:20", endedAt: "15:30" });
  };
  const first = pause({
    id: "srv-1",
    startedAt: "2026-09-24T13:00:00.000Z",
    endedAt: "2026-09-24T13:10:00.000Z",
    open: false,
  });
  const afterDelete = session({ ...twoBreaks, breaks: closed.breaks });
  const afterFirstAdd = session({ ...twoBreaks, breaks: [...closed.breaks, first] });

  async function saveFailingOnTheSecondAdd() {
    const held = draft();
    const result = await runCorrection(correctionSteps(twoBreaks, held, PRAGUE), async (step) => {
      if (step.kind === "delete-break") return afterDelete;
      if (step.kind === "add-break" && step.draftId === "new-1") return afterFirstAdd;
      throw new TypeError("Network request failed");
    });
    return settleDraft(held, result.landed);
  }

  it("drops a deleted break and gives an added one the server's id", async () => {
    const settled = await saveFailingOnTheSecondAdd();

    expect(settled.breaks.map((entry) => [entry.id, Boolean(entry.isNew)])).toEqual([
      ["lunch", false],
      ["srv-1", false],
      ["new-2", true],
    ]);
  });

  it("retries only the break that did not land, once the day is read again", async () => {
    const settled = await saveFailingOnTheSecondAdd();

    expect(correctionSteps(afterFirstAdd, settled, PRAGUE)).toEqual([
      {
        kind: "add-break",
        sessionId: "s1",
        draftId: "new-2",
        span: { startedAt: "2026-09-24T13:20:00.000Z", endedAt: "2026-09-24T13:30:00.000Z" },
      },
    ]);
  });

  it("retries only that break even when the read again did not arrive", async () => {
    const settled = await saveFailingOnTheSecondAdd();

    expect(correctionSteps(twoBreaks, settled, PRAGUE).map((step) => step.kind)).toEqual([
      "add-break",
    ]);
  });
});

describe("correctionClosed", () => {
  const TODAY = "2026-09-27";
  const own = (overrides: Parameters<typeof attendance>[0] = {}) =>
    attendance({ selfService: { enabled: true, days: 3 }, ...overrides });

  it("is open for a closed session inside the window", () => {
    expect(correctionClosed({ state: own(), session: closed, today: TODAY })).toBeNull();
  });

  it("names the window for a closed session before it", () => {
    const old = session({ ...closed, businessDate: "2026-09-20" });

    expect(correctionClosed({ state: own(), session: old, today: TODAY })).toBe(
      "SELF_SERVICE_WINDOW"
    );
  });

  it("keeps a session still open correctable whatever its date", () => {
    const left = session({ businessDate: "2026-09-20", endedAt: null, open: true });

    expect(correctionClosed({ state: own(), session: left, today: TODAY })).toBeNull();
  });

  it("names a lapsed plan, an ended Employment and a window switched off", () => {
    expect(correctionClosed({ state: own({ active: false }), session: closed, today: TODAY })).toBe(
      "PLAN_LIMIT"
    );
    expect(
      correctionClosed({ state: own({ employmentEnded: true }), session: closed, today: TODAY })
    ).toBe("EMPLOYMENT_ENDED");
    expect(
      correctionClosed({
        state: own({ selfService: { enabled: false, days: 3 } }),
        session: closed,
        today: TODAY,
      })
    ).toBe("SELF_SERVICE_OFF");
    expect(
      correctionClosed({ state: own({ selfService: undefined }), session: closed, today: TODAY })
    ).toBe("SELF_SERVICE_OFF");
  });
});

describe("sessionDeletable", () => {
  const TODAY = "2026-09-24";

  it("lets the reader delete a session they entered, whatever its date", () => {
    const entered = session({
      ...closed,
      businessDate: "2026-09-20",
      origin: "ENTERED",
      enteredByUserId: "me",
    });

    expect(sessionDeletable({ session: entered, today: TODAY, viewerId: "me" })).toEqual({
      deletable: true,
      entered: true,
    });
  });

  it("keeps a session an admin entered, with the admin hint", () => {
    const entered = session({ ...closed, origin: "ENTERED", enteredByUserId: "admin" });

    expect(sessionDeletable({ session: entered, today: TODAY, viewerId: "me" })).toEqual({
      deletable: false,
      hint: "ENTERED_BY_ADMIN",
    });
  });

  it("lets the reader delete a session clocked today", () => {
    expect(sessionDeletable({ session: closed, today: TODAY, viewerId: "me" })).toEqual({
      deletable: true,
      entered: false,
    });
  });

  it("keeps a session clocked on an earlier day, with the earlier-day hint", () => {
    expect(sessionDeletable({ session: closed, today: "2026-09-25", viewerId: "me" })).toEqual({
      deletable: false,
      hint: "CLOCKED_EARLIER",
    });
  });

  it("keeps an entered session while the reader is not known yet", () => {
    const entered = session({ ...closed, origin: "ENTERED", enteredByUserId: "me" });

    expect(sessionDeletable({ session: entered, today: TODAY, viewerId: null })).toMatchObject({
      deletable: false,
    });
  });
});

describe("flagsOnSave", () => {
  it("flags a session from a day that has passed", () => {
    expect(flagsOnSave({ session: closed, today: "2026-09-25", administersOwn: false })).toBe(true);
  });

  it("does not flag today's session", () => {
    expect(flagsOnSave({ session: closed, today: "2026-09-24", administersOwn: false })).toBe(
      false
    );
  });

  it("does not flag for a reader who administers their own attendance", () => {
    expect(flagsOnSave({ session: closed, today: "2026-09-25", administersOwn: true })).toBe(false);
  });
});

describe("correctionSheetErrors", () => {
  it("does not ask for the end of a break still running", () => {
    const running = session({
      startedAt: "2026-09-24T06:00:00.000Z",
      businessDate: "2026-09-24",
      endedAt: null,
      breaks: [pause({ id: "now", startedAt: "2026-09-24T10:00:00.000Z", endedAt: null })],
    });

    expect(correctionSheetErrors(heldDraft(running, PRAGUE), "2026-09-24", PRAGUE)).toEqual({});
  });

  it("leaves a removed break out of the checks", () => {
    const draft = withBreakRemoved(
      withBreakChanged(heldDraft(closed, PRAGUE), "lunch", { startedAt: "07:00" }),
      "lunch"
    );

    expect(correctionSheetErrors(draft, "2026-09-24", PRAGUE)).toEqual({});
  });

  it("still names a break outside its session", () => {
    const draft = withBreakChanged(heldDraft(closed, PRAGUE), "lunch", { startedAt: "07:00" });

    expect(correctionSheetErrors(draft, "2026-09-24", PRAGUE).breaks).toEqual({
      lunch: "BREAK_OUTSIDE_SESSION",
    });
  });
});

describe("correctionSave", () => {
  const step: CorrectionStep = { kind: "delete-break", breakId: "lunch" };
  const base = { steps: [step], errors: {}, saving: false, closed: false, failure: null };

  it("is enabled with something to send", () => {
    expect(correctionSave(base)).toEqual({ enabled: true, retry: false });
  });

  it("is disabled with nothing to send, an error, a save under way or a closed day", () => {
    expect(correctionSave({ ...base, steps: [] }).enabled).toBe(false);
    expect(correctionSave({ ...base, errors: { endedAt: "END_BEFORE_START" } }).enabled).toBe(
      false
    );
    expect(correctionSave({ ...base, saving: true }).enabled).toBe(false);
    expect(correctionSave({ ...base, closed: true }).enabled).toBe(false);
  });

  it("turns into a retry after no answer or a server fault, not after a refusal", () => {
    expect(correctionSave({ ...base, failure: { kind: "network" } }).retry).toBe(true);
    expect(correctionSave({ ...base, failure: { kind: "server" } }).retry).toBe(true);
    expect(
      correctionSave({
        ...base,
        failure: {
          kind: "refused",
          status: 409,
          reason: "BREAK_OVERLAPS",
          ceilingMinutes: null,
          serverMessage: null,
        },
      }).retry
    ).toBe(false);
  });
});

// Still running since 08:00 on 27 September, with a break running since 12:00.
const running = session({
  id: "s1",
  businessDate: "2026-09-27",
  startedAt: "2026-09-27T06:00:00.000Z",
  endedAt: null,
  open: true,
  breaks: [pause({ id: "now", startedAt: "2026-09-27T10:00:00.000Z", endedAt: null, open: true })],
});
// The same session once clocked out at 16:00, its break closed at 12:30.
const clockedOut = session({
  ...running,
  endedAt: "2026-09-27T14:00:00.000Z",
  open: false,
  breaks: [
    pause({
      id: "now",
      startedAt: "2026-09-27T10:00:00.000Z",
      endedAt: "2026-09-27T10:30:00.000Z",
      open: false,
    }),
  ],
});

describe("correctionSteps never reopens", () => {
  it("sends no end for a session closed after the draft was taken", () => {
    const draft = { ...heldDraft(running, PRAGUE), startedAt: "07:30" };

    expect(correctionSteps(clockedOut, draft, PRAGUE)).toEqual([
      { kind: "patch-session", sessionId: "s1", patch: { startedAt: "2026-09-27T05:30:00.000Z" } },
    ]);
  });

  it("sends no end for a break closed after the draft was taken", () => {
    const draft = withBreakChanged(heldDraft(running, PRAGUE), "now", { startedAt: "11:45" });

    expect(correctionSteps(clockedOut, draft, PRAGUE)).toEqual([
      { kind: "patch-break", breakId: "now", patch: { startedAt: "2026-09-27T09:45:00.000Z" } },
    ]);
  });
});

describe("rebaseDraft", () => {
  it("takes the end the server gave a session that closed while the sheet was open", () => {
    const draft = { ...heldDraft(running, PRAGUE), startedAt: "07:30" };

    expect(rebaseDraft(draft, clockedOut, PRAGUE)).toEqual({
      startedAt: "07:30",
      endedAt: "16:00",
      breaks: [{ id: "now", startedAt: "12:00", endedAt: "12:30", running: false }],
    });
  });

  it("keeps a break the reader moved, taking only its new end", () => {
    const draft = withBreakChanged(heldDraft(running, PRAGUE), "now", { startedAt: "11:45" });

    expect(rebaseDraft(draft, clockedOut, PRAGUE).breaks).toEqual([
      { id: "now", startedAt: "11:45", endedAt: "12:30", running: false },
    ]);
  });

  it("leaves a draft alone while the session still runs", () => {
    const draft = heldDraft(running, PRAGUE);

    expect(rebaseDraft(draft, running, PRAGUE)).toEqual(draft);
  });
});

describe("correctionSteps after an add whose answer was lost", () => {
  it("sends no add for a break the server already holds under another id", () => {
    let draft = withBreakAdded(heldDraft(closed, PRAGUE));
    draft = withBreakChanged(draft, "new-1", { startedAt: "15:00", endedAt: "15:10" });
    const landed = session({
      ...closed,
      breaks: [
        ...closed.breaks,
        pause({
          id: "srv-1",
          startedAt: "2026-09-24T13:00:00.000Z",
          endedAt: "2026-09-24T13:10:00.000Z",
          open: false,
        }),
      ],
    });

    expect(correctionSteps(landed, draft, PRAGUE)).toEqual([]);
    expect(rebaseDraft(draft, landed, PRAGUE).breaks.map((entry) => entry.id)).toEqual([
      "lunch",
      "srv-1",
    ]);
    expect(heldEdited(landed, rebaseDraft(draft, landed, PRAGUE), PRAGUE)).toBe(false);
  });
});

describe("correctionSheetErrors, a break still running", () => {
  const NOW = new Date("2026-09-27T12:00:00.000Z");

  it("names a running break the session's start moved past", () => {
    const draft = { ...heldDraft(running, PRAGUE), startedAt: "12:15" };

    expect(correctionSheetErrors(draft, "2026-09-27", PRAGUE, NOW).breaks).toEqual({
      now: "BREAK_OUTSIDE_SESSION",
    });
  });

  it("names a running break moved before the session's start", () => {
    const draft = withBreakChanged(heldDraft(running, PRAGUE), "now", { startedAt: "07:30" });

    expect(correctionSheetErrors(draft, "2026-09-27", PRAGUE, NOW).breaks).toEqual({
      now: "BREAK_OUTSIDE_SESSION",
    });
  });

  it("names a closed break moved over the running one", () => {
    const withLunch = session({
      ...running,
      breaks: [
        pause({
          id: "coffee",
          startedAt: "2026-09-27T07:00:00.000Z",
          endedAt: "2026-09-27T07:15:00.000Z",
          open: false,
        }),
        ...running.breaks,
      ],
    });
    const draft = withBreakChanged(heldDraft(withLunch, PRAGUE), "coffee", {
      startedAt: "12:30",
      endedAt: "12:45",
    });

    expect(correctionSheetErrors(draft, "2026-09-27", PRAGUE, NOW).breaks).toEqual({
      now: "BREAK_OVERLAPS",
    });
  });
});

describe("correctionSteps, mixed moves", () => {
  it("widens the session first and narrows it last when one end does each", () => {
    // Start 08:00 to 07:00 widens, end 16:00 to 15:00 narrows, and the coffee moves to 14:30.
    let draft = { ...heldDraft(twoBreaks, PRAGUE), startedAt: "07:00", endedAt: "15:00" };
    draft = withBreakChanged(draft, "coffee", { startedAt: "14:30", endedAt: "14:45" });

    expect(correctionSteps(twoBreaks, draft, PRAGUE)).toEqual([
      { kind: "patch-session", sessionId: "s1", patch: { startedAt: "2026-09-24T05:00:00.000Z" } },
      {
        kind: "patch-break",
        breakId: "coffee",
        patch: { startedAt: "2026-09-24T12:30:00.000Z", endedAt: "2026-09-24T12:45:00.000Z" },
      },
      { kind: "patch-session", sessionId: "s1", patch: { endedAt: "2026-09-24T13:00:00.000Z" } },
    ]);
  });

  it("moves a break out of a slot before another break moves into it", () => {
    // Lunch 12:00-12:30 moves to 13:00-13:30; coffee 14:00-14:15 moves into 12:00-12:15.
    let draft = withBreakChanged(heldDraft(twoBreaks, PRAGUE), "coffee", {
      startedAt: "12:00",
      endedAt: "12:15",
    });
    draft = withBreakChanged(draft, "lunch", { startedAt: "13:00", endedAt: "13:30" });

    expect(
      correctionSteps(twoBreaks, draft, PRAGUE).map((step) =>
        step.kind === "patch-break" ? step.breakId : step.kind
      )
    ).toEqual(["lunch", "coffee"]);
  });

  it("moves the later break first when it is the one that vacates", () => {
    // Coffee 14:00-14:15 moves to 15:00-15:15; lunch 12:00-12:30 grows to 12:00-14:10.
    let draft = withBreakChanged(heldDraft(twoBreaks, PRAGUE), "lunch", { endedAt: "14:10" });
    draft = withBreakChanged(draft, "coffee", { startedAt: "15:00", endedAt: "15:15" });

    expect(
      correctionSteps(twoBreaks, draft, PRAGUE).map((step) =>
        step.kind === "patch-break" ? step.breakId : step.kind
      )
    ).toEqual(["coffee", "lunch"]);
  });
});
