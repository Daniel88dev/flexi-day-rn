import { clockView, dayTotals, deriveClock } from "@/lib/attendance/clock";
import { ApiError } from "@/lib/query/failure";
import { attendance, pause, session } from "@/test-support/attendance";

const NOW = new Date("2026-09-27T09:47:12.000Z").getTime();

describe("deriveClock", () => {
  it("returns out with nothing running when no session is open", () => {
    const reading = deriveClock(attendance(), NOW);

    expect(reading.status).toBe("out");
    expect(reading.runningSince).toBeNull();
  });

  it("returns in, running from the open session's start, while clocked in", () => {
    const open = session();

    const reading = deriveClock(attendance({ openSession: open, sessions: [open] }), NOW);

    expect(reading.status).toBe("in");
    expect(reading.runningSince).toBe("2026-09-27T06:00:00.000Z");
  });

  it("returns break, running from the break's start, while a break is open", () => {
    const openBreak = pause();
    const open = session({ breaks: [openBreak] });

    const reading = deriveClock(
      attendance({ openSession: open, openBreak, sessions: [open] }),
      NOW
    );

    expect(reading.status).toBe("break");
    expect(reading.runningSince).toBe("2026-09-27T08:00:00.000Z");
  });

  it("returns inactive, with nothing stranded, when attendance is off", () => {
    const reading = deriveClock(attendance({ active: false }), NOW);

    expect(reading.status).toBe("inactive");
    expect(reading.stranded).toBe(false);
  });

  it("returns inactive once the Employment has ended, even while attendance is on", () => {
    expect(deriveClock(attendance({ employmentEnded: true }), NOW).status).toBe("inactive");
  });

  it("returns a stranded session when attendance went off with one still open", () => {
    const open = session();

    const reading = deriveClock(attendance({ active: false, openSession: open }), NOW);

    expect(reading.status).toBe("inactive");
    expect(reading.stranded).toBe(true);
  });

  it("returns nothing stranded once the Employment has ended, since clocking out is refused too", () => {
    const reading = deriveClock(attendance({ employmentEnded: true, openSession: session() }), NOW);

    expect(reading.stranded).toBe(false);
  });

  it("returns the day's totals, counting the open session and break up to now", () => {
    const morning = session({
      id: "s0",
      startedAt: "2026-09-27T04:00:00.000Z",
      endedAt: "2026-09-27T05:30:00.000Z",
      open: false,
      breaks: [
        pause({
          id: "b0",
          startedAt: "2026-09-27T04:30:00.000Z",
          endedAt: "2026-09-27T04:45:00.000Z",
          open: false,
        }),
      ],
    });
    const openBreak = pause({ startedAt: "2026-09-27T09:40:00.000Z" });
    const open = session({ breaks: [openBreak] });

    const reading = deriveClock(
      attendance({ openSession: open, openBreak, sessions: [morning, open] }),
      NOW
    );

    // 1:30 closed plus 3:47 running; a 0:15 break closed plus 0:07 running.
    expect(reading.totals).toEqual({ presenceMinutes: 317, breakMinutes: 22, sessions: 2 });
  });

  it("returns no auto-closed session when the sweep touched nothing", () => {
    expect(deriveClock(attendance(), NOW).autoClosed).toBeNull();
  });

  it("returns the session the sweep closed, its length and when it closed", () => {
    const swept = session({
      businessDate: "2026-09-26",
      startedAt: "2026-09-26T05:58:00.000Z",
      endedAt: "2026-09-26T21:58:00.000Z",
      closedBy: "SWEEP",
      open: false,
    });

    expect(deriveClock(attendance({ autoClosedSession: swept }), NOW).autoClosed).toEqual({
      kind: "session",
      businessDate: "2026-09-26",
      minutes: 960,
      closedAt: "2026-09-26T21:58:00.000Z",
      timezone: "Europe/Prague",
    });
  });

  it("returns the break the sweep closed ahead of its session", () => {
    const swept = session({
      businessDate: "2026-09-26",
      breaks: [
        pause({
          startedAt: "2026-09-26T10:00:00.000Z",
          endedAt: "2026-09-26T12:00:00.000Z",
          autoClosed: true,
          open: false,
        }),
      ],
    });

    expect(deriveClock(attendance({ autoClosedSession: swept }), NOW).autoClosed).toEqual({
      kind: "break",
      businessDate: "2026-09-26",
      minutes: 120,
      closedAt: "2026-09-26T12:00:00.000Z",
      timezone: "Europe/Prague",
    });
  });
});

describe("clockView", () => {
  const READ_AT = NOW - 6 * 60_000;

  it("returns loading while the first read is on its way", () => {
    expect(clockView({ data: undefined, error: null, readAt: 0, online: true })).toEqual({
      kind: "loading",
    });
  });

  it("returns no Employment when /current answers 404", () => {
    const error = new ApiError(404, "No employment");

    expect(clockView({ data: undefined, error, readAt: 0, online: true })).toEqual({
      kind: "no-employment",
    });
  });

  it("returns unreachable when nothing was ever read and the read got no answer", () => {
    const error = new TypeError("Network request failed");

    expect(clockView({ data: undefined, error, readAt: 0, online: true })).toEqual({
      kind: "unreachable",
    });
  });

  it("returns unreachable on a cold start offline, before the read has even failed", () => {
    expect(clockView({ data: undefined, error: null, readAt: 0, online: false })).toEqual({
      kind: "unreachable",
    });
  });

  it("returns the last read, online, when it arrived", () => {
    const data = attendance();

    expect(clockView({ data, error: null, readAt: READ_AT, online: true })).toEqual({
      kind: "ready",
      state: data,
      offline: false,
      readAt: READ_AT,
    });
  });

  it("keeps the last read, offline, when the re-read got no answer", () => {
    const data = attendance();
    const error = new TypeError("Network request failed");

    expect(clockView({ data, error, readAt: READ_AT, online: true })).toMatchObject({
      kind: "ready",
      offline: true,
    });
  });

  it("keeps the last read, offline, when the phone has no network", () => {
    const data = attendance();

    expect(clockView({ data, error: null, readAt: READ_AT, online: false })).toMatchObject({
      kind: "ready",
      offline: true,
    });
  });

  it("keeps the last read online when the re-read met a server fault", () => {
    const data = attendance();
    const error = new ApiError(503, "Unavailable");

    expect(clockView({ data, error, readAt: READ_AT, online: true })).toMatchObject({
      kind: "ready",
      offline: false,
    });
  });

  it("returns read failed when nothing was ever read and the server faulted", () => {
    const error = new ApiError(500, "Internal");

    expect(clockView({ data: undefined, error, readAt: 0, online: true })).toEqual({
      kind: "read-failed",
    });
  });
});

describe("dayTotals", () => {
  it("returns presence and breaks over a past day's closed sessions", () => {
    const closed = session({
      startedAt: "2026-09-20T06:00:00.000Z",
      endedAt: "2026-09-20T10:00:00.000Z",
      open: false,
      breaks: [
        pause({
          startedAt: "2026-09-20T08:00:00.000Z",
          endedAt: "2026-09-20T08:30:00.000Z",
          open: false,
        }),
      ],
    });
    expect(dayTotals([closed], Date.parse("2026-09-27T12:00:00Z"))).toEqual({
      presenceMinutes: 240,
      breakMinutes: 30,
      sessions: 1,
    });
  });
});
