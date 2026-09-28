import type { Dictionary } from "@/i18n";

import { formatClockTime } from "./format";
import type { AttendanceEventType } from "./types";

export type { AttendanceEventType };

/** One entry of a session's timeline, as `/sessions/:id/events` sends it, oldest first. */
export type AttendanceEvent = {
  id: string;
  sessionId: string;
  eventType: AttendanceEventType;
  /** Null is the sweep, or an account that has since gone. */
  user: { id: string; name: string } | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export function historyText(
  event: AttendanceEvent,
  timezone: string | null,
  t: Dictionary
): string {
  const after = event.after as { startedAt?: unknown; endedAt?: unknown } | null;
  if (typeof after?.startedAt === "string" && typeof after.endedAt === "string") {
    const from = formatClockTime(after.startedAt, timezone);
    const to = formatClockTime(after.endedAt, timezone);
    if (event.eventType === "SESSION_CREATED") return t.correction.sessionEntered(from, to);
    if (event.eventType === "BREAK_ADDED") return t.correction.breakAdded(from, to);
  }
  return t.correction.events[event.eventType] ?? event.eventType;
}

/** An instant as `Thu 24 Sep 08:52` in the organization's zone: a change can come days later. */
export function historyStamp(iso: string, timezone: string | null, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  let day: string;
  try {
    day = new Intl.DateTimeFormat(locale, timezone ? { ...options, timeZone: timezone } : options)
      .format(date)
      .replace(",", "");
  } catch {
    day = new Intl.DateTimeFormat(locale, options).format(date).replace(",", "");
  }
  return `${day} ${formatClockTime(iso, timezone)}`;
}

/** Who entered the session, as its first event names them; the "Entered by" mark reads this. */
export function enteredByName(events: AttendanceEvent[]): string | null {
  return events.find((event) => event.eventType === "SESSION_CREATED")?.user?.name ?? null;
}
