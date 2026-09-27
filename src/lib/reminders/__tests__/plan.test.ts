import { attendance, workingMonth as month, pause, session } from "@/test-support/attendance";

import { planClockReminders } from "../plan";
import { DEFAULT_REMINDER_PREFS, type ReminderPrefs } from "../prefs";

/** A wall-clock instant on the phone, the way the reminders fire. */
const at = (iso: string, time: string) => {
  const [year, monthNumber, day] = iso.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, monthNumber - 1, day, hours, minutes).getTime();
};

const clockInOn: ReminderPrefs = {
  ...DEFAULT_REMINDER_PREFS,
  clockIn: { enabled: true, time: "08:00", weekdays: null },
  clockOut: { enabled: false },
};

const today = "2026-09-28";
const current = attendance({ businessDate: today });
const months = [month(2026, 9), month(2026, 10)];

const clockInDates = (plan: ReturnType<typeof planClockReminders>) =>
  plan.filter((entry) => entry.kind === "clock-in").map((entry) => entry.id.slice(9));

describe("planClockReminders", () => {
  describe("clock-in", () => {
    it("returns one reminder per working day from today to the end of next month, at the picked time", () => {
      const plan = planClockReminders({
        prefs: clockInOn,
        current,
        months,
        now: at(today, "07:00"),
      });

      const dates = clockInDates(plan);
      expect(dates[0]).toBe("2026-09-28");
      expect(dates.at(-1)).toBe("2026-10-30");
      expect(dates).toHaveLength(3 + 22);
      expect(dates).not.toContain("2026-10-03");
      expect(plan[0]).toEqual({
        id: "clock-in:2026-09-28",
        kind: "clock-in",
        fireAt: at(today, "08:00"),
      });
    });

    it("returns none on a HALF exclusion, since the phone cannot know which half is off", () => {
      const halfDay = month(2026, 9, {
        "2026-09-29": {
          exclusion: { cause: "ABSENCE", extent: "HALF", label: "VACATION" },
          requiredMinutes: 240,
        },
      });

      const plan = planClockReminders({
        prefs: clockInOn,
        current,
        months: [halfDay, month(2026, 10)],
        now: at(today, "07:00"),
      });

      expect(clockInDates(plan)).not.toContain("2026-09-29");
      expect(clockInDates(plan)).toContain("2026-09-30");
    });

    it("returns none on a FULL exclusion: a holiday or a day off", () => {
      const october = month(2026, 10, {
        "2026-10-28": { exclusion: { cause: "HOLIDAY", extent: "FULL", label: "Statehood Day" } },
        "2026-10-29": {
          exclusion: { cause: "ABSENCE", extent: "FULL", label: "VACATION" },
          requiredMinutes: 0,
        },
      });

      const plan = planClockReminders({
        prefs: clockInOn,
        current,
        months: [month(2026, 9), october],
        now: at(today, "07:00"),
      });

      expect(clockInDates(plan)).not.toContain("2026-10-28");
      expect(clockInDates(plan)).not.toContain("2026-10-29");
      expect(clockInDates(plan)).toContain("2026-10-30");
    });

    it("returns none on a weekday the user unticked", () => {
      const plan = planClockReminders({
        prefs: { ...clockInOn, clockIn: { ...clockInOn.clockIn, weekdays: [1, 2, 3, 4] } },
        current,
        months,
        now: at(today, "07:00"),
      });

      expect(clockInDates(plan)).not.toContain("2026-10-02");
      expect(clockInDates(plan)).toContain("2026-10-01");
    });

    it("returns none on a weekday ticked but not worked: the server's exclusion wins", () => {
      const plan = planClockReminders({
        prefs: { ...clockInOn, clockIn: { ...clockInOn.clockIn, weekdays: [0, 1, 2, 3, 4, 5, 6] } },
        current,
        months,
        now: at(today, "07:00"),
      });

      expect(clockInDates(plan)).not.toContain("2026-10-03");
    });

    it("returns none for today once the picked time has passed", () => {
      const plan = planClockReminders({
        prefs: clockInOn,
        current,
        months,
        now: at(today, "08:00"),
      });

      expect(clockInDates(plan)[0]).toBe("2026-09-29");
    });

    it("returns none for today when /current shows a session today, closed or open", () => {
      const closed = session({ businessDate: today, endedAt: "2026-09-28T05:00:00.000Z" });
      const open = session({ businessDate: today });

      for (const state of [
        attendance({ businessDate: today, sessions: [closed] }),
        attendance({ businessDate: today, sessions: [open], openSession: open }),
      ]) {
        const plan = planClockReminders({
          prefs: clockInOn,
          current: state,
          months,
          now: at(today, "06:00"),
        });
        expect(clockInDates(plan)[0]).toBe("2026-09-29");
      }
    });

    it("stops at the end of next month across a year boundary", () => {
      const plan = planClockReminders({
        prefs: clockInOn,
        current: attendance({ businessDate: "2026-12-30" }),
        months: [month(2026, 12), month(2027, 1), month(2027, 2)],
        now: at("2026-12-30", "07:00"),
      });

      const dates = clockInDates(plan);
      expect(dates[0]).toBe("2026-12-30");
      expect(dates.at(-1)).toBe("2027-01-29");
    });

    it("returns none on a date whose month has not been read", () => {
      const plan = planClockReminders({
        prefs: clockInOn,
        current,
        months: [month(2026, 9)],
        now: at(today, "07:00"),
      });

      expect(clockInDates(plan)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    });

    it("returns none while the clock-in switch is off", () => {
      const plan = planClockReminders({
        prefs: DEFAULT_REMINDER_PREFS,
        current,
        months,
        now: at(today, "07:00"),
      });

      expect(clockInDates(plan)).toEqual([]);
    });
  });

  describe("clock-out", () => {
    const clockOutOn: ReminderPrefs = DEFAULT_REMINDER_PREFS;
    const open = (overrides: Parameters<typeof session>[0] = {}) =>
      session({
        id: "open",
        businessDate: today,
        startedAt: "2026-09-28T06:00:00.000Z",
        ...overrides,
      });
    const clockedIn = (
      openSession: ReturnType<typeof session>,
      closed: ReturnType<typeof session>[] = []
    ) => attendance({ businessDate: today, openSession, sessions: [...closed, openSession] });
    const clockOut = (plan: ReturnType<typeof planClockReminders>) =>
      plan.filter((entry) => entry.kind === "clock-out");
    const utc = (iso: string) => new Date(iso).getTime();

    it("returns one at start + required + the allowance + 15 min, once past the break threshold", () => {
      const plan = planClockReminders({
        prefs: clockOutOn,
        current: clockedIn(open()),
        months,
        now: utc("2026-09-28T07:00:00.000Z"),
      });

      // 480 required + 30 allowance, no break taken yet.
      expect(clockOut(plan)).toEqual([
        { id: "clock-out", kind: "clock-out", fireAt: utc("2026-09-28T14:45:00.000Z") },
      ]);
    });

    it("returns one that counts the breaks taken when they pass the allowance", () => {
      const openSession = open({
        breaks: [
          pause({
            sessionId: "open",
            startedAt: "2026-09-28T09:00:00.000Z",
            endedAt: "2026-09-28T09:45:00.000Z",
            open: false,
          }),
        ],
      });

      const plan = planClockReminders({
        prefs: clockOutOn,
        current: clockedIn(openSession),
        months,
        now: utc("2026-09-28T10:00:00.000Z"),
      });

      expect(clockOut(plan)[0].fireAt).toBe(utc("2026-09-28T15:00:00.000Z"));
    });

    it("returns one that counts a break still running up to now", () => {
      const openSession = open({
        breaks: [pause({ sessionId: "open", startedAt: "2026-09-28T10:00:00.000Z" })],
      });

      const plan = planClockReminders({
        prefs: clockOutOn,
        current: clockedIn(openSession),
        months,
        now: utc("2026-09-28T10:40:00.000Z"),
      });

      // 480 + max(30, 40) + 15.
      expect(clockOut(plan)[0].fireAt).toBe(utc("2026-09-28T14:55:00.000Z"));
    });

    it("returns one less the presence already closed today, whose breaks count too", () => {
      const closed = session({
        id: "earlier",
        businessDate: today,
        startedAt: "2026-09-28T03:00:00.000Z",
        endedAt: "2026-09-28T05:00:00.000Z",
        open: false,
        breaks: [
          pause({
            sessionId: "earlier",
            startedAt: "2026-09-28T04:00:00.000Z",
            endedAt: "2026-09-28T04:40:00.000Z",
            open: false,
          }),
        ],
      });

      const plan = planClockReminders({
        prefs: clockOutOn,
        current: clockedIn(open(), [closed]),
        months,
        now: utc("2026-09-28T07:00:00.000Z"),
      });

      // 480 + max(30, 40) − 120 closed + 15 = 415 min after 06:00.
      expect(clockOut(plan)[0].fireAt).toBe(utc("2026-09-28T12:55:00.000Z"));
    });

    it("returns one at required + breaks for a part-time day that stays under the threshold", () => {
      const partTime = month(2026, 9, {}, {});
      for (const day of partTime.days) if (day.requiredMinutes) day.requiredMinutes = 240;
      const openSession = open({
        breaks: [
          pause({
            sessionId: "open",
            startedAt: "2026-09-28T07:00:00.000Z",
            endedAt: "2026-09-28T07:10:00.000Z",
            open: false,
          }),
        ],
      });

      const plan = planClockReminders({
        prefs: clockOutOn,
        current: clockedIn(openSession),
        months: [partTime, month(2026, 10)],
        now: utc("2026-09-28T08:00:00.000Z"),
      });

      // 240 + 10 taken, no allowance under 360 of presence, + 15.
      expect(clockOut(plan)[0].fireAt).toBe(utc("2026-09-28T10:25:00.000Z"));
    });

    it("returns one on a HALF day, whose required time the server already halved", () => {
      const halfDay = month(2026, 9, {
        [today]: {
          exclusion: { cause: "ABSENCE", extent: "HALF", label: "VACATION" },
          requiredMinutes: 240,
        },
      });

      const plan = planClockReminders({
        prefs: clockOutOn,
        current: clockedIn(open()),
        months: [halfDay, month(2026, 10)],
        now: utc("2026-09-28T07:00:00.000Z"),
      });

      expect(clockOut(plan)[0].fireAt).toBe(utc("2026-09-28T10:15:00.000Z"));
    });

    it("returns none on a FULL-excluded day, even while clocked in", () => {
      const holiday = month(2026, 9, {
        [today]: {
          exclusion: { cause: "HOLIDAY", extent: "FULL", label: null },
          requiredMinutes: 0,
        },
      });

      const plan = planClockReminders({
        prefs: clockOutOn,
        current: clockedIn(open()),
        months: [holiday, month(2026, 10)],
        now: utc("2026-09-28T07:00:00.000Z"),
      });

      expect(clockOut(plan)).toEqual([]);
    });

    it("returns none once the moment has passed", () => {
      const plan = planClockReminders({
        prefs: clockOutOn,
        current: clockedIn(open()),
        months,
        now: utc("2026-09-28T14:45:00.000Z"),
      });

      expect(clockOut(plan)).toEqual([]);
    });

    it("moves with a break still running: each /current read counts it up to now", () => {
      const openSession = open({
        breaks: [pause({ sessionId: "open", startedAt: "2026-09-28T10:00:00.000Z" })],
      });
      const at = (now: string) =>
        clockOut(
          planClockReminders({
            prefs: clockOutOn,
            current: clockedIn(openSession),
            months,
            now: utc(now),
          })
        )[0].fireAt;

      // 480 + max(30, 20) + 15, then 480 + max(30, 50) + 15.
      expect(at("2026-09-28T10:20:00.000Z")).toBe(utc("2026-09-28T14:45:00.000Z"));
      expect(at("2026-09-28T10:50:00.000Z")).toBe(utc("2026-09-28T15:05:00.000Z"));
    });

    it("returns one for a session opened yesterday, counting yesterday's closed presence and breaks from /month", () => {
      const yesterday = "2026-09-28";
      const earlier = session({
        id: "earlier",
        businessDate: yesterday,
        startedAt: "2026-09-28T06:00:00.000Z",
        endedAt: "2026-09-28T10:00:00.000Z",
        open: false,
        breaks: [
          pause({
            sessionId: "earlier",
            startedAt: "2026-09-28T08:00:00.000Z",
            endedAt: "2026-09-28T08:40:00.000Z",
            open: false,
          }),
        ],
      });
      const late = open({ businessDate: yesterday, startedAt: "2026-09-28T20:00:00.000Z" });
      const september = month(2026, 9, { [yesterday]: { sessions: [earlier, late] } });

      const plan = planClockReminders({
        prefs: clockOutOn,
        current: attendance({ businessDate: "2026-09-29", openSession: late, sessions: [] }),
        months: [september, month(2026, 10)],
        now: utc("2026-09-29T00:30:00.000Z"),
      });

      // 480 + max(30, 40) − 240 closed + 15 = 295 min after 20:00.
      expect(clockOut(plan)[0].fireAt).toBe(utc("2026-09-29T00:55:00.000Z"));
    });

    it("returns one for a session opened on the last day of the previous month, from that month's read", () => {
      const lastOfSeptember = "2026-09-30";
      const late = open({ businessDate: lastOfSeptember, startedAt: "2026-09-30T20:00:00.000Z" });

      const plan = planClockReminders({
        prefs: clockOutOn,
        current: attendance({ businessDate: "2026-10-01", openSession: late, sessions: [] }),
        months: [month(2026, 9), month(2026, 10), month(2026, 11)],
        now: utc("2026-10-01T00:30:00.000Z"),
      });

      expect(clockOut(plan)[0].fireAt).toBe(utc("2026-10-01T04:45:00.000Z"));
    });

    it("returns none without an open session, or with the switch off, or before the month is read", () => {
      const now = utc("2026-09-28T07:00:00.000Z");
      expect(clockOut(planClockReminders({ prefs: clockOutOn, current, months, now }))).toEqual([]);
      expect(
        clockOut(
          planClockReminders({
            prefs: { ...clockOutOn, clockOut: { enabled: false } },
            current: clockedIn(open()),
            months,
            now,
          })
        )
      ).toEqual([]);
      expect(
        clockOut(
          planClockReminders({ prefs: clockOutOn, current: clockedIn(open()), months: [], now })
        )
      ).toEqual([]);
    });
  });

  describe("nothing at all", () => {
    const openSession = session({ businessDate: today, startedAt: "2026-09-28T06:00:00.000Z" });
    const everything: ReminderPrefs = { ...clockInOn, clockOut: { enabled: true } };

    it.each([
      [
        "attendance is off or lapsed",
        attendance({ businessDate: today, active: false, openSession, sessions: [openSession] }),
      ],
      [
        "the Employment ended",
        attendance({
          businessDate: today,
          employmentEnded: true,
          openSession,
          sessions: [openSession],
        }),
      ],
      ["/current answered 404", null],
    ])("returns nothing when %s", (_why, state) => {
      expect(
        planClockReminders({ prefs: everything, current: state, months, now: at(today, "07:00") })
      ).toEqual([]);
    });
  });
});
