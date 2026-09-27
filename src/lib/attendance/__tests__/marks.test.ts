import { pause, session } from "@/test-support/attendance";

import { sessionMarks } from "../marks";

const TODAY = "2026-09-27";

const closed = { endedAt: "2026-09-20T14:00:00.000Z", open: false, closedBy: "USER" } as const;

describe("sessionMarks", () => {
  it("returns none for a session clocked and closed by its owner", () => {
    expect(sessionMarks(session({ businessDate: "2026-09-20", ...closed }), TODAY)).toEqual([]);
  });

  it("returns entered for a session recorded after the fact", () => {
    expect(
      sessionMarks(session({ businessDate: "2026-09-20", ...closed, origin: "ENTERED" }), TODAY)
    ).toEqual([{ kind: "entered" }]);
  });

  it("returns changed for a session its owner changed after the day", () => {
    expect(
      sessionMarks(session({ businessDate: "2026-09-20", ...closed, changedAfterDay: true }), TODAY)
    ).toEqual([{ kind: "changed" }]);
  });

  it("returns auto-closed for a session the sweep closed", () => {
    expect(
      sessionMarks(session({ businessDate: "2026-09-20", ...closed, closedBy: "SWEEP" }), TODAY)
    ).toEqual([{ kind: "auto-closed" }]);
  });

  it("returns no session mark for a break the sweep closed, which its own row carries", () => {
    const sweptBreak = session({
      businessDate: "2026-09-20",
      ...closed,
      breaks: [pause({ autoClosed: true, endedAt: "2026-09-20T12:00:00.000Z", open: false })],
    });
    expect(sessionMarks(sweptBreak, TODAY)).toEqual([]);
  });

  it("returns still open as somebody at work today, and as a flag on a day that has passed", () => {
    expect(sessionMarks(session({ businessDate: TODAY }), TODAY)).toEqual([
      { kind: "still-open", overdue: false },
    ]);
    expect(sessionMarks(session({ businessDate: "2026-09-26" }), TODAY)).toEqual([
      { kind: "still-open", overdue: true },
    ]);
  });

  it("returns every mark that applies, in the web's order", () => {
    const everything = session({
      businessDate: "2026-09-20",
      ...closed,
      origin: "ENTERED",
      changedAfterDay: true,
      closedBy: "SWEEP",
    });
    expect(sessionMarks(everything, TODAY).map((mark) => mark.kind)).toEqual([
      "entered",
      "changed",
      "auto-closed",
    ]);
  });

  it("returns none of the newer marks from a backend that sends no origin", () => {
    const older = session({ businessDate: "2026-09-20", ...closed });
    delete older.origin;
    delete older.changedAfterDay;
    expect(sessionMarks(older, TODAY)).toEqual([]);
  });
});
