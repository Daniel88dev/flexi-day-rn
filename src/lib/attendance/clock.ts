// The failure module rather than the query index: the index brings the session client, the
// toaster and the Local store, whose ESM builds break every Jest file that imports this one.
import { ApiError } from "@/lib/query/failure";

import type { AttendanceSession, AttendanceState } from "./types";

type Span = { startedAt: string; endedAt: string | null };

/** Whole minutes, floored and never negative: forty seconds in reads 0:00. */
export function minutesBetween(from: string, to: string | number): number {
  const start = new Date(from).getTime();
  const end = typeof to === "number" ? to : new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 60_000));
}

const spanMinutes = (span: Span, now: number) =>
  minutesBetween(span.startedAt, span.endedAt ?? now);

/** Presence, breaks and the session count of a day's sessions, open spans running to `now`. */
export function dayTotals(sessions: AttendanceSession[], now: number) {
  return {
    presenceMinutes: sessions.reduce((sum, entry) => sum + spanMinutes(entry, now), 0),
    breakMinutes: sessions.reduce(
      (sum, entry) =>
        sum + entry.breaks.reduce((inner, pause) => inner + spanMinutes(pause, now), 0),
      0
    ),
    sessions: sessions.length,
  };
}

export type AutoClosed = {
  kind: "session" | "break";
  businessDate: string;
  minutes: number;
  closedAt: string;
  timezone: string;
};

// A break the sweep closed wins over its session: that is the earlier wrong number, and one
// correction fixes both.
function autoClosedOf(swept: AttendanceSession | null): AutoClosed | null {
  if (!swept) return null;
  const entry = swept.breaks.find((pause) => pause.autoClosed);
  const span = entry ?? swept;
  const closedAt = span.endedAt ?? span.startedAt;
  return {
    kind: entry ? "break" : "session",
    businessDate: swept.businessDate,
    minutes: minutesBetween(span.startedAt, closedAt),
    closedAt,
    timezone: swept.timezone,
  };
}

export type ClockStatus = "inactive" | "out" | "in" | "break";

export type DerivedClock = {
  status: ClockStatus;
  runningSince: string | null;
  /** Inactive with a session still open, which Clock out may still close. */
  stranded: boolean;
  totals: { presenceMinutes: number; breakMinutes: number; sessions: number };
  autoClosed: AutoClosed | null;
};

export function clockStatusOf(state: AttendanceState): ClockStatus {
  if (!state.active || state.employmentEnded) return "inactive";
  if (!state.openSession) return "out";
  return state.openBreak ? "break" : "in";
}

export function deriveClock(state: AttendanceState, now: number): DerivedClock {
  const status = clockStatusOf(state);
  return {
    status,
    runningSince: state.openBreak?.startedAt ?? state.openSession?.startedAt ?? null,
    // An ended Employment refuses the clock-out too.
    stranded: status === "inactive" && !state.employmentEnded && state.openSession !== null,
    totals: dayTotals(state.sessions, now),
    autoClosed: autoClosedOf(state.autoClosedSession),
  };
}

export type ClockView =
  | { kind: "loading" }
  | { kind: "no-employment" }
  | { kind: "unreachable" }
  | { kind: "read-failed" }
  | { kind: "ready"; state: AttendanceState; offline: boolean; readAt: number };

const NOT_FOUND = 404;

const gotNoAnswer = (error: unknown) => error != null && !(error instanceof ApiError);

/**
 * What the clock can show from the `/current` read as the query cache holds it. A 404 means no
 * Employment, so there is no clock at all. Only a read that got no answer counts as offline; a
 * server fault keeps the last read without disabling anything.
 */
export function clockView({
  data,
  error,
  readAt,
  online,
}: {
  data: AttendanceState | undefined;
  error: unknown;
  readAt: number;
  online: boolean;
}): ClockView {
  if (error instanceof ApiError && error.status === NOT_FOUND) return { kind: "no-employment" };
  const offline = !online || gotNoAnswer(error);
  if (data) return { kind: "ready", state: data, offline, readAt };
  if (offline) return { kind: "unreachable" };
  if (error != null) return { kind: "read-failed" };
  return { kind: "loading" };
}
