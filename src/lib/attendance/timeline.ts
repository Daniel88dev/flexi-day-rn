import { dayNumber } from "@/lib/days";

import { minutesBetween } from "./clock";
import type { AttendanceSession } from "./types";

export type SessionRow = {
  kind: "work" | "break";
  startedAt: string;
  /** Null while the row is still running. */
  endedAt: string | null;
  minutes: number;
  /** The sweep ended this one, so its length is the ceiling rather than the truth. */
  autoClosed: boolean;
};

/**
 * One session as alternating work and break rows, the web's day view order. A closed work stretch
 * under a minute is left out: clocking in and going straight on a break says nothing worth a row.
 */
export function sessionRows(session: AttendanceSession, now: number): SessionRow[] {
  const breaks = [...session.breaks].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const rows: SessionRow[] = [];

  const pushWork = (from: string, to: string | null) => {
    const minutes = minutesBetween(from, to ?? now);
    if (to !== null && minutes === 0) return;
    rows.push({ kind: "work", startedAt: from, endedAt: to, minutes, autoClosed: false });
  };

  let cursor = session.startedAt;
  for (const pause of breaks) {
    pushWork(cursor, pause.startedAt);
    rows.push({
      kind: "break",
      startedAt: pause.startedAt,
      endedAt: pause.endedAt,
      minutes: minutesBetween(pause.startedAt, pause.endedAt ?? now),
      autoClosed: pause.autoClosed,
    });
    // An open break runs to the end of the session, so nothing follows it.
    if (pause.endedAt === null) return rows;
    cursor = pause.endedAt;
  }

  pushWork(cursor, session.endedAt);
  return rows;
}

export type TimelineStrip = {
  /** Positions are fractions of the strip's width, 0 at its left edge. */
  ticks: { label: string; at: number }[];
  spans: { kind: "work" | "break"; from: number; to: number }[];
  /** The now line, on a live day only. */
  now: number | null;
};

const HOUR = 60;
const DAY = 24 * HOUR;
const MIN_SPAN = 8 * HOUR;
const MAX_LABELS = 5;
const TICK_STEPS = [1, 2, 3, 4, 6, 8, 12].map((hours) => hours * HOUR);

function tickStep(width: number): number {
  const fits = (step: number) => Math.floor(width / step) + 1 <= MAX_LABELS;
  return TICK_STEPS.find(fits) ?? Math.ceil(width / (MAX_LABELS - 1) / HOUR) * HOUR;
}

const pad = (value: number) => String(value).padStart(2, "0");

function localParts(instant: number, timeZone: string | null) {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  };
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-GB", timeZone ? { ...options, timeZone } : options);
  } catch {
    format = new Intl.DateTimeFormat("en-GB", options);
  }
  const parts = Object.fromEntries(
    format.formatToParts(new Date(instant)).map((part) => [part.type, part.value])
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * HOUR + Number(parts.minute) + Number(parts.second) / 60,
  };
}

/** Minutes from the business date's local midnight, past 1440 for a session that ran over. */
function minuteOfDay(instant: number, businessDate: string, timeZone: string | null): number {
  const local = localParts(instant, timeZone);
  return (dayNumber(local.day) - dayNumber(businessDate)) * DAY + local.minutes;
}

/**
 * The instant a business date ends in the organization's zone. The second pass corrects for a
 * daylight saving change on that day.
 */
export function endOfBusinessDay(businessDate: string, timezone: string | null): number {
  let instant = Date.parse(`${businessDate}T12:00:00Z`);
  for (let pass = 0; pass < 2; pass += 1) {
    instant += (DAY - minuteOfDay(instant, businessDate, timezone)) * 60_000;
  }
  return instant;
}

/**
 * The strip over a day's session rows: the whole hours around its sessions, eight at least, in the
 * organization's zone. A short late day widens backwards rather than into the next morning.
 */
export function timelineStrip({
  sessions,
  businessDate,
  timezone,
  now,
  live,
}: {
  sessions: AttendanceSession[];
  businessDate: string;
  timezone: string | null;
  now: number;
  live: boolean;
}): TimelineStrip | null {
  if (sessions.length === 0) return null;

  // A span still open on a day that has passed runs to that day's end, not on into the next.
  const minute = (iso: string | null) => {
    if (iso === null && !live) return DAY;
    return minuteOfDay(iso === null ? now : new Date(iso).getTime(), businessDate, timezone);
  };

  const raw = sessions.flatMap((entry) => [
    { kind: "work" as const, from: minute(entry.startedAt), to: minute(entry.endedAt) },
    ...entry.breaks.map((pause) => ({
      kind: "break" as const,
      from: minute(pause.startedAt),
      to: minute(pause.endedAt),
    })),
  ]);
  const nowMinute = live ? minute(null) : null;

  const edges = raw.flatMap((span) => [span.from, span.to]);
  if (nowMinute !== null) edges.push(nowMinute);
  const latest = Math.max(...edges);
  let start = Math.floor(Math.min(...edges) / HOUR) * HOUR;
  let end = Math.max(Math.ceil(latest / HOUR) * HOUR, start + MIN_SPAN);
  if (end > DAY && latest <= DAY) {
    end = DAY;
    start = Math.max(0, Math.min(start, DAY - MIN_SPAN));
  }

  const width = end - start;
  const at = (value: number) => (value - start) / width;
  const step = tickStep(width);
  const ticks = [];
  for (let tick = start; tick <= end; tick += step) {
    ticks.push({ label: `${pad(Math.floor(tick / HOUR) % 24)}:00`, at: at(tick) });
  }

  return {
    ticks,
    spans: raw.map((span) => ({ kind: span.kind, from: at(span.from), to: at(span.to) })),
    now: nowMinute === null ? null : at(nowMinute),
  };
}
