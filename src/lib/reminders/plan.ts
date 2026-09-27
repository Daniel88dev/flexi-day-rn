import { dayTotals } from "@/lib/attendance/clock";
import type { AttendanceMonth, AttendanceMonthDay, AttendanceState } from "@/lib/attendance/types";
import { addDays, dayOfDate, lastOfNextMonth, weekdayOf } from "@/lib/days";

import type { ReminderPrefs } from "./prefs";

const GRACE_MINUTES = 15;
const MINUTE = 60_000;

export type ReminderKind = "clock-in" | "clock-out";

export type PlannedReminder = { id: string; kind: ReminderKind; fireAt: number };

export type PlanInput = {
  prefs: ReminderPrefs;
  /** Null when `/current` answered 404: no Employment, so no clock. */
  current: AttendanceState | null;
  months: readonly AttendanceMonth[];
  now: number;
};

/** The picked wall-clock time on a business date, in the phone's own timezone. */
function wallClock(iso: string, time: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

function daysByDate(months: readonly AttendanceMonth[]): Map<string, AttendanceMonthDay> {
  const byDate = new Map<string, AttendanceMonthDay>();
  for (const month of months) {
    for (const day of month.days) byDate.set(day.businessDate, day);
  }
  return byDate;
}

function planClockIn(
  prefs: ReminderPrefs["clockIn"],
  current: AttendanceState,
  days: Map<string, AttendanceMonthDay>,
  today: string,
  now: number
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const last = lastOfNextMonth(today);
  const clockedToday = current.openSession !== null || current.sessions.length > 0;
  for (let date = today; date <= last; date = addDays(date, 1)) {
    if (date === today && clockedToday) continue;
    const day = days.get(date);
    if (!day || day.exclusion) continue;
    if (prefs.weekdays && !prefs.weekdays.includes(weekdayOf(date))) continue;
    const fireAt = wallClock(date, prefs.time);
    if (fireAt <= now) continue;
    planned.push({ id: `clock-in:${date}`, kind: "clock-in", fireAt });
  }
  return planned;
}

/**
 * The presence the day needs for its worked time to reach required, by the backend's rule:
 * breaks taken are deducted while presence stays within the threshold, the larger of them and
 * the allowance once it passes.
 */
function requiredPresence(required: number, breaks: number, month: AttendanceMonth): number {
  const underThreshold = required + breaks;
  if (underThreshold <= month.breakThresholdMinutes) return underThreshold;
  return required + Math.max(month.breakMinutes, breaks);
}

function planClockOut(
  current: AttendanceState,
  months: readonly AttendanceMonth[],
  now: number
): PlannedReminder | null {
  const open = current.openSession;
  if (!open) return null;
  const month = months.find((candidate) =>
    candidate.days.some((day) => day.businessDate === open.businessDate)
  );
  const day = month?.days.find((candidate) => candidate.businessDate === open.businessDate);
  if (!month || !day || day.exclusion?.extent === "FULL") return null;

  // A session that crossed midnight keeps the date it started on; `/current` only lists
  // today's sessions, so that day's others come from its `/month` entry.
  const known = open.businessDate === current.businessDate ? current.sessions : day.sessions;
  const closed = known.filter(
    (entry) => entry.businessDate === open.businessDate && entry.id !== open.id
  );
  const breaks = dayTotals([...closed, open], now).breakMinutes;
  const closedPresence = dayTotals(closed, now).presenceMinutes;
  const target = requiredPresence(day.requiredMinutes, breaks, month);

  const fireAt =
    new Date(open.startedAt).getTime() + (target - closedPresence + GRACE_MINUTES) * MINUTE;
  if (!Number.isFinite(fireAt) || fireAt <= now) return null;
  return { id: "clock-out", kind: "clock-out", fireAt };
}

export function planClockReminders({ prefs, current, months, now }: PlanInput): PlannedReminder[] {
  if (!current || !current.active || current.employmentEnded) return [];
  const today = current.businessDate ?? dayOfDate(new Date(now));
  const planned = prefs.clockIn.enabled
    ? planClockIn(prefs.clockIn, current, daysByDate(months), today, now)
    : [];
  const clockOut = prefs.clockOut.enabled ? planClockOut(current, months, now) : null;
  return clockOut ? [...planned, clockOut] : planned;
}
