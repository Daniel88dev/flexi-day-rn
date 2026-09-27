import { pause, session } from "@/test-support/attendance";

import { endOfBusinessDay, sessionRows, timelineStrip } from "../timeline";

const at = (iso: string) => new Date(iso).getTime();
const ZONE = "Europe/Prague";

describe("sessionRows", () => {
  it("returns work and break rows in turn, a break splitting the work around it", () => {
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

    expect(sessionRows(closed, at("2026-09-20T18:00:00Z"))).toEqual([
      {
        kind: "work",
        startedAt: "2026-09-20T06:00:00.000Z",
        endedAt: "2026-09-20T08:00:00.000Z",
        minutes: 120,
        autoClosed: false,
      },
      {
        kind: "break",
        startedAt: "2026-09-20T08:00:00.000Z",
        endedAt: "2026-09-20T08:30:00.000Z",
        minutes: 30,
        autoClosed: false,
      },
      {
        kind: "work",
        startedAt: "2026-09-20T08:30:00.000Z",
        endedAt: "2026-09-20T10:00:00.000Z",
        minutes: 90,
        autoClosed: false,
      },
    ]);
  });

  it("returns an open break as the last row, running to now", () => {
    const running = session({
      startedAt: "2026-09-27T06:00:00.000Z",
      breaks: [pause({ startedAt: "2026-09-27T08:00:00.000Z" })],
    });

    const rows = sessionRows(running, at("2026-09-27T08:12:30Z"));

    expect(rows.map((row) => [row.kind, row.endedAt, row.minutes])).toEqual([
      ["work", "2026-09-27T08:00:00.000Z", 120],
      ["break", null, 12],
    ]);
  });

  it("returns no row for a closed work stretch under a minute", () => {
    const straightOnBreak = session({
      startedAt: "2026-09-20T06:00:00.000Z",
      endedAt: "2026-09-20T07:00:00.000Z",
      open: false,
      breaks: [
        pause({
          startedAt: "2026-09-20T06:00:20.000Z",
          endedAt: "2026-09-20T07:00:00.000Z",
          open: false,
        }),
      ],
    });

    expect(sessionRows(straightOnBreak, at("2026-09-20T18:00:00Z")).map((row) => row.kind)).toEqual(
      ["break"]
    );
  });

  it("returns a break the sweep closed flagged as auto-closed", () => {
    const swept = session({
      startedAt: "2026-09-20T06:00:00.000Z",
      endedAt: "2026-09-20T14:00:00.000Z",
      open: false,
      breaks: [
        pause({
          startedAt: "2026-09-20T10:00:00.000Z",
          endedAt: "2026-09-20T14:00:00.000Z",
          autoClosed: true,
          open: false,
        }),
      ],
    });

    const flagged = sessionRows(swept, at("2026-09-20T18:00:00Z")).filter((row) => row.autoClosed);
    expect(flagged.map((row) => row.kind)).toEqual(["break"]);
  });
});

describe("timelineStrip", () => {
  const pastDay = [
    session({
      businessDate: "2026-09-20",
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
    }),
  ];

  it("returns the whole hours around a past day's sessions, at least eight of them, in the organization's zone", () => {
    const strip = timelineStrip({
      sessions: pastDay,
      businessDate: "2026-09-20",
      timezone: ZONE,
      now: at("2026-09-27T12:00:00Z"),
      live: false,
    });

    expect(strip?.ticks.map((tick) => [tick.label, tick.at])).toEqual([
      ["08:00", 0],
      ["10:00", 0.25],
      ["12:00", 0.5],
      ["14:00", 0.75],
      ["16:00", 1],
    ]);
    expect(strip?.spans).toEqual([
      { kind: "work", from: 0, to: 0.5 },
      { kind: "break", from: 0.25, to: 0.3125 },
    ]);
    expect(strip?.now).toBeNull();
  });

  it("returns an open session running to a now line on today", () => {
    const strip = timelineStrip({
      sessions: [session({ startedAt: "2026-09-27T06:00:00.000Z" })],
      businessDate: "2026-09-27",
      timezone: ZONE,
      now: at("2026-09-27T12:06:00Z"),
      live: true,
    });

    expect(strip?.ticks[0]).toEqual({ label: "08:00", at: 0 });
    expect(strip?.spans).toEqual([{ kind: "work", from: 0, to: 0.7625 }]);
    expect(strip?.now).toBe(0.7625);
  });

  it("returns hours past midnight for a session that ran into the next day", () => {
    const strip = timelineStrip({
      sessions: [
        session({
          businessDate: "2026-09-20",
          startedAt: "2026-09-20T20:00:00.000Z",
          endedAt: "2026-09-21T00:30:00.000Z",
          open: false,
        }),
      ],
      businessDate: "2026-09-20",
      timezone: ZONE,
      now: at("2026-09-27T12:00:00Z"),
      live: false,
    });

    expect(strip?.ticks.map((tick) => tick.label)).toEqual([
      "22:00",
      "00:00",
      "02:00",
      "04:00",
      "06:00",
    ]);
    expect(strip?.spans).toEqual([{ kind: "work", from: 0, to: 0.5625 }]);
  });

  it("returns a late evening widened backwards rather than into the next day", () => {
    const strip = timelineStrip({
      sessions: [
        session({
          businessDate: "2026-09-20",
          startedAt: "2026-09-20T18:00:00.000Z",
          endedAt: "2026-09-20T20:00:00.000Z",
          open: false,
        }),
      ],
      businessDate: "2026-09-20",
      timezone: ZONE,
      now: at("2026-09-27T12:00:00Z"),
      live: false,
    });

    expect(strip?.ticks.map((tick) => tick.label)).toEqual([
      "16:00",
      "18:00",
      "20:00",
      "22:00",
      "00:00",
    ]);
    expect(strip?.spans).toEqual([{ kind: "work", from: 0.5, to: 0.75 }]);
  });

  it("returns null for a day without sessions", () => {
    expect(
      timelineStrip({
        sessions: [],
        businessDate: "2026-09-27",
        timezone: ZONE,
        now: at("2026-09-27T12:00:00Z"),
        live: true,
      })
    ).toBeNull();
  });

  const closedFrom0700 = (hours: number) =>
    timelineStrip({
      sessions: [
        session({
          businessDate: "2026-09-20",
          startedAt: "2026-09-20T05:00:00.000Z",
          endedAt: new Date(Date.parse("2026-09-20T05:00:00Z") + hours * 3_600_000).toISOString(),
          open: false,
        }),
      ],
      businessDate: "2026-09-20",
      timezone: ZONE,
      now: at("2026-09-27T12:00:00Z"),
      live: false,
    });

  const ticksOf = (hours: number) =>
    closedFrom0700(hours)?.ticks.map((tick) => [tick.label, Number(tick.at.toFixed(4))]);

  it("returns each hour label at its own place on a strip its step does not divide", () => {
    expect(ticksOf(9)).toEqual([
      ["07:00", 0],
      ["09:00", 0.2222],
      ["11:00", 0.4444],
      ["13:00", 0.6667],
      ["15:00", 0.8889],
    ]);
  });

  it("returns no more than five labels, however wide the strip", () => {
    expect(ticksOf(10)).toEqual([
      ["07:00", 0],
      ["10:00", 0.3],
      ["13:00", 0.6],
      ["16:00", 0.9],
    ]);
    expect(ticksOf(11)).toEqual([
      ["07:00", 0],
      ["10:00", 0.2727],
      ["13:00", 0.5455],
      ["16:00", 0.8182],
    ]);
    expect(ticksOf(13)).toEqual([
      ["07:00", 0],
      ["10:00", 0.2308],
      ["13:00", 0.4615],
      ["16:00", 0.6923],
      ["19:00", 0.9231],
    ]);
    expect(ticksOf(15)).toEqual([
      ["07:00", 0],
      ["11:00", 0.2667],
      ["15:00", 0.5333],
      ["19:00", 0.8],
    ]);
  });

  it("returns a session still open on a past day ending with that day, with no now line", () => {
    const strip = timelineStrip({
      sessions: [session({ businessDate: "2026-09-24", startedAt: "2026-09-24T05:00:00.000Z" })],
      businessDate: "2026-09-24",
      timezone: ZONE,
      now: at("2026-09-27T12:00:00Z"),
      live: false,
    });

    expect(strip?.spans).toEqual([{ kind: "work", from: 0, to: 1 }]);
    expect(strip?.now).toBeNull();
    expect(strip?.ticks.length).toBeLessThanOrEqual(5);
    expect(strip?.ticks[0]).toEqual({ label: "07:00", at: 0 });
  });
});

describe("endOfBusinessDay", () => {
  it("returns the instant the business date ends in the organization's zone", () => {
    expect(new Date(endOfBusinessDay("2026-09-24", ZONE)).toISOString()).toBe(
      "2026-09-24T22:00:00.000Z"
    );
  });

  it("returns the right instant across a daylight saving change", () => {
    expect(new Date(endOfBusinessDay("2026-10-25", ZONE)).toISOString()).toBe(
      "2026-10-25T23:00:00.000Z"
    );
  });
});
