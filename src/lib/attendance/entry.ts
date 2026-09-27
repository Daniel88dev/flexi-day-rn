// Ported from `flexi-day/lib/attendance/entry.ts`; its tests came with it.
import { addDays } from "@/lib/days";

import {
  breakErrors,
  filledSpans,
  instantAt,
  resolveBreaks,
  type BreakDraft,
  type BreakErrors,
} from "./correction";
import { formatClockTime } from "./format";
import type { AttendanceBreakSpan } from "./types";

/** The Employment's first and last day as far as a read gives them away. */
export type KnownSpell = { began: string | null; ended: string | null };

/**
 * The "Add a session" form: a business date, a start and an end in the
 * organization's zone, and whether the end falls on the next day. A switch
 * rather than an end read as tomorrow whenever it is earlier than the start,
 * so a mistyped end reads as an error instead of as a night shift.
 *
 * The backend checks all of it again, and the rules only it can see (the
 * session ceiling, the Employment's spell) come back as refusals.
 */
export type EntryDraft = {
  businessDate: string;
  startedAt: string;
  endedAt: string;
  nextDay: boolean;
  /** Saved with the session in the same request, so a refused one saves nothing. */
  breaks: BreakDraft[];
};

export type EntryError =
  | { kind: "REQUIRED" }
  | { kind: "OUTSIDE_WINDOW" }
  | { kind: "FUTURE_DATE" }
  | { kind: "BEFORE_EMPLOYMENT"; began: string }
  | { kind: "AFTER_EMPLOYMENT"; ended: string }
  | { kind: "END_BEFORE_START" }
  | { kind: "END_IN_FUTURE"; now: string }
  | { kind: "OVERLAPS"; from: string; to: string | null };

export type EntryErrors = BreakErrors & {
  businessDate?: EntryError;
  startedAt?: EntryError;
  endedAt?: EntryError;
};

/** The draft's two instants, or null where a field is not a time yet. */
export function entrySpan(
  draft: EntryDraft,
  timezone: string | null
): { startedAt: string | null; endedAt: string | null } {
  if (draft.businessDate === "") return { startedAt: null, endedAt: null };
  return {
    startedAt: instantAt(draft.businessDate, draft.startedAt, timezone),
    endedAt: instantAt(
      draft.nextDay ? addDays(draft.businessDate, 1) : draft.businessDate,
      draft.endedAt,
      timezone
    ),
  };
}

export function entryErrors(
  draft: EntryDraft,
  context: {
    timezone: string | null;
    now: Date;
    /** Today in the organization's zone. */
    today: string;
    /** The earliest date the reader may enter; null without a limit. */
    earliest: string | null;
    /** The day's other sessions, to name the one an entry would run over. */
    sessions: { startedAt: string; endedAt: string | null }[];
    spell?: KnownSpell;
  }
): EntryErrors {
  const errors: EntryErrors = {};

  if (draft.businessDate === "") errors.businessDate = { kind: "REQUIRED" };
  else if (draft.businessDate > context.today) errors.businessDate = { kind: "FUTURE_DATE" };
  else if (context.earliest !== null && draft.businessDate < context.earliest) {
    errors.businessDate = { kind: "OUTSIDE_WINDOW" };
  } else if (context.spell?.began && draft.businessDate < context.spell.began) {
    errors.businessDate = { kind: "BEFORE_EMPLOYMENT", began: context.spell.began };
  } else if (context.spell?.ended && draft.businessDate > context.spell.ended) {
    errors.businessDate = { kind: "AFTER_EMPLOYMENT", ended: context.spell.ended };
  }

  const span = entrySpan(draft, context.timezone);
  if (span.startedAt === null) errors.startedAt = { kind: "REQUIRED" };
  if (span.endedAt === null) errors.endedAt = { kind: "REQUIRED" };
  Object.assign(errors, breakErrors(resolvedBreaks(draft, context.timezone), span));
  if (span.startedAt === null || span.endedAt === null) return errors;

  const start = Date.parse(span.startedAt);
  const end = Date.parse(span.endedAt);

  if (end <= start) {
    errors.endedAt = { kind: "END_BEFORE_START" };
  } else if (end > context.now.getTime()) {
    errors.endedAt = {
      kind: "END_IN_FUTURE",
      now: formatClockTime(context.now.toISOString(), context.timezone),
    };
  }

  // Half-open, as the backend reads it: back to back is not an overlap.
  const over = context.sessions.find(
    (session) =>
      Date.parse(session.startedAt) < end &&
      (session.endedAt === null || Date.parse(session.endedAt) > start)
  );
  if (over && errors.endedAt?.kind !== "END_BEFORE_START") {
    errors.startedAt = {
      kind: "OVERLAPS",
      from: formatClockTime(over.startedAt, context.timezone),
      to: over.endedAt === null ? null : formatClockTime(over.endedAt, context.timezone),
    };
  }

  return errors;
}

const resolvedBreaks = (draft: EntryDraft, timezone: string | null) =>
  resolveBreaks(draft.breaks, draft.businessDate, entrySpan(draft, timezone), timezone);

export function entryBreaks(draft: EntryDraft, timezone: string | null): AttendanceBreakSpan[] {
  return filledSpans(resolvedBreaks(draft, timezone));
}

export type BreakRules = { breakMinutes: number; breakThresholdMinutes: number };

type Span = { startedAt: string; endedAt: string | null };

const minutesOf = (span: AttendanceBreakSpan) =>
  Math.max(0, Math.floor((Date.parse(span.endedAt) - Date.parse(span.startedAt)) / 60_000));

/**
 * What the day will count once the entry is saved, by the rule a clocked day
 * follows (`flexi-day-be/docs/attendance.md`, "Worked time"). The day's other
 * sessions count too, because the threshold is the day's and not the session's.
 * A break the form still refuses is left out rather than guessed at.
 */
export function entryFigures(
  draft: EntryDraft,
  context: {
    timezone: string | null;
    sessions: (Span & { breaks: Span[] })[];
    rules: BreakRules;
  }
): { presenceMinutes: number; breaksMinutes: number; workedMinutes: number } | null {
  const span = entrySpan(draft, context.timezone);
  if (span.startedAt === null || span.endedAt === null || span.endedAt <= span.startedAt) {
    return null;
  }
  const entered = { startedAt: span.startedAt, endedAt: span.endedAt };

  const closed = (spans: Span[]) =>
    spans.flatMap((entry) =>
      entry.endedAt === null ? [] : [{ startedAt: entry.startedAt, endedAt: entry.endedAt }]
    );
  const resolved = resolvedBreaks(draft, context.timezone);
  const refused = breakErrors(resolved, span).breaks ?? {};
  const breaks = [
    ...closed(context.sessions.flatMap((session) => session.breaks)),
    ...filledSpans(resolved.filter((entry) => refused[entry.id] === undefined)),
  ];

  const presenceMinutes = [...closed(context.sessions), entered].reduce(
    (total, entry) => total + minutesOf(entry),
    0
  );
  const breaksMinutes = breaks.reduce((total, entry) => total + minutesOf(entry), 0);
  const deducted =
    presenceMinutes > context.rules.breakThresholdMinutes
      ? Math.max(context.rules.breakMinutes, breaksMinutes)
      : breaksMinutes;

  return { presenceMinutes, breaksMinutes, workedMinutes: Math.max(0, presenceMinutes - deducted) };
}
