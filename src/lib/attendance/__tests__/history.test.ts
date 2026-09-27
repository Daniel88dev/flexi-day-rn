import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

import { enteredByName, historyStamp, historyText, type AttendanceEvent } from "../history";

const PRAGUE = "Europe/Prague";

const event = (overrides: Partial<AttendanceEvent>): AttendanceEvent => ({
  id: "e1",
  sessionId: "s1",
  eventType: "CLOCK_IN",
  user: { id: "u1", name: "Dana Novak" },
  before: null,
  after: null,
  createdAt: "2026-09-24T06:00:00.000Z",
  ...overrides,
});

describe("historyText", () => {
  it("names a plain event by its type", () => {
    expect(historyText(event({ eventType: "SESSION_EDITED" }), PRAGUE, en)).toBe("Times corrected");
    expect(historyText(event({ eventType: "BREAK_DELETED" }), PRAGUE, cs)).toBe("Odebrána pauza");
  });

  it("carries the times of an entered session and an added break", () => {
    const span = { startedAt: "2026-09-24T06:00:00.000Z", endedAt: "2026-09-24T14:00:00.000Z" };

    expect(historyText(event({ eventType: "SESSION_CREATED", after: span }), PRAGUE, en)).toBe(
      "Session entered, 08:00 to 16:00"
    );
    expect(historyText(event({ eventType: "BREAK_ADDED", after: span }), PRAGUE, en)).toBe(
      "Break added, 08:00 to 16:00"
    );
  });
});

describe("historyStamp", () => {
  it("reads the instant as the day and time in the organization's zone", () => {
    // ICU spells September "Sept" in en-GB on some builds.
    expect(historyStamp("2026-09-24T21:30:00.000Z", PRAGUE, "en-GB")).toMatch(
      /^Thu 24 Sept? 23:30$/
    );
  });
});

describe("enteredByName", () => {
  it("returns who entered the session, from its first event", () => {
    const events = [
      event({ eventType: "SESSION_CREATED", user: { id: "a", name: "Petra Admin" } }),
      event({ id: "e2", eventType: "SESSION_EDITED" }),
    ];

    expect(enteredByName(events)).toBe("Petra Admin");
  });

  it("returns null for a clocked session or an entry whose author has gone", () => {
    expect(enteredByName([event({})])).toBeNull();
    expect(enteredByName([event({ eventType: "SESSION_CREATED", user: null })])).toBeNull();
  });
});
