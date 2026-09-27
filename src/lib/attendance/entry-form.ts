import type { Dictionary } from "@/i18n";

import { entryFigures, type EntryDraft, type EntryError, type EntryErrors } from "./entry";
import { formatClockTime } from "./format";
import type { EntryFailure } from "./refusals";
import { selfServiceVerdict, type SelfServiceWindow } from "./self-service";
import type { AttendanceMonth, AttendanceSession } from "./types";

const QUARTER = 15;

/**
 * Where an empty time field's picker opens: the quarter hour already begun in the organization's
 * zone, which `instantAt` reads the field in. Rounding up would put a default end on today in the
 * future, which the form refuses.
 */
export function quarterHourNow(now: Date, timezone: string | null): string {
  const [hours = "00", minutes = "00"] = formatClockTime(
    now.toISOString(),
    timezone ?? "UTC"
  ).split(":");
  const floored = Math.floor(Number(minutes) / QUARTER) * QUARTER;
  return `${hours}:${String(floored).padStart(2, "0")}`;
}

const HOUR = 60;
const HALF_HOUR = 30;
const DAY = 24 * HOUR;

const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * HOUR + minutes;
};

const timeOf = (minutes: number) => {
  const wrapped = ((minutes % DAY) + DAY) % DAY;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(wrapped / HOUR))}:${pad(wrapped % HOUR)}`;
};

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

export type TimeField =
  | { field: "start" }
  | { field: "end" }
  | { field: "break-start"; breakId: string }
  | { field: "break-end"; breakId: string };

/**
 * Where an empty time field's picker opens, so no two fields open on the same minute: the end an
 * hour after the start, a break an hour into the session and half an hour long, each kept inside
 * the session and, on today, no later than the quarter hour already begun.
 */
export function defaultTime(
  draft: EntryDraft,
  target: TimeField,
  context: { now: Date; timezone: string | null; today: string }
): string {
  const fallback = quarterHourNow(context.now, context.timezone);
  if (draft.startedAt === "") return fallback;

  // Minutes from the start's midnight, so an end on the next day sorts after the start.
  const start = minutesOf(draft.startedAt);
  const ahead = (time: string) => {
    const minutes = minutesOf(time);
    return draft.nextDay && minutes < start ? minutes + DAY : minutes;
  };
  const end = draft.endedAt === "" ? Infinity : ahead(draft.endedAt);

  if (target.field === "start") return fallback;
  if (target.field === "end") {
    const later = start + HOUR;
    if (draft.businessDate !== context.today) return timeOf(later);
    return timeOf(Math.min(later, minutesOf(fallback)));
  }

  const breakStart = clamp(start + HOUR, start, end);
  if (target.field === "break-start") return timeOf(breakStart);
  const entry = draft.breaks.find((candidate) => candidate.id === target.breakId);
  const from = entry && entry.startedAt !== "" ? ahead(entry.startedAt) : breakStart;
  return timeOf(clamp(from + HALF_HOUR, from, end));
}

/** Save turns into Retry after a failure the same tap may get past. */
export function entrySave({
  draft,
  errors,
  saving,
  closed,
  failure,
}: {
  draft: EntryDraft;
  errors: EntryErrors;
  saving: boolean;
  /** The day stopped offering entry, as a 402 or 403 and the re-read after it can show. */
  closed: boolean;
  failure: EntryFailure | null;
}): { enabled: boolean; retry: boolean } {
  const invalid = Boolean(
    errors.businessDate ?? errors.startedAt ?? errors.endedAt ?? errors.breaks
  );
  const filled = draft.startedAt !== "" && draft.endedAt !== "";
  return {
    enabled: filled && !invalid && !saving && !closed,
    retry: failure?.kind === "network" || failure?.kind === "server",
  };
}

export type ClosedReason =
  | "PLAN_LIMIT"
  | "EMPLOYMENT_ENDED"
  | "SELF_SERVICE_OFF"
  | "OUTSIDE_EMPLOYMENT"
  | "SELF_SERVICE_WINDOW";

/** Why the draft's day takes no entry, as the backend would refuse it, or null when it does. */
export function entryClosed({
  window,
  active,
  employmentEnded,
  today,
  day,
}: {
  window: SelfServiceWindow | undefined;
  active: boolean;
  employmentEnded: boolean;
  today: string;
  day: { businessDate: string; upcoming: boolean; exclusion: { cause: string } | null };
}): ClosedReason | null {
  if (!active) return "PLAN_LIMIT";
  if (employmentEnded) return "EMPLOYMENT_ENDED";
  if (!window?.enabled) return "SELF_SERVICE_OFF";
  if (day.exclusion?.cause === "NOT_EMPLOYED") return "OUTSIDE_EMPLOYMENT";
  const verdict = selfServiceVerdict({
    window,
    businessDate: day.businessDate,
    today,
    open: false,
    employmentEnded,
  });
  return verdict === "OPEN" && !day.upcoming ? null : "SELF_SERVICE_WINDOW";
}

export function entryDirty(draft: EntryDraft, openedOn: string): boolean {
  return (
    draft.businessDate !== openedOn ||
    draft.startedAt !== "" ||
    draft.endedAt !== "" ||
    draft.nextDay ||
    draft.breaks.length > 0
  );
}

function fieldMessage(error: EntryError | undefined, t: Dictionary) {
  const words = t.entry.errors;
  switch (error?.kind) {
    // Every field opens empty, so "needs a time" would greet the reader; Save stays disabled.
    case undefined:
    case "REQUIRED":
      return null;
    case "OUTSIDE_WINDOW":
      return words.OUTSIDE_WINDOW;
    case "FUTURE_DATE":
      return words.FUTURE_DATE;
    // Only a read that names the spell produces these, and the sheet passes none.
    case "BEFORE_EMPLOYMENT":
    case "AFTER_EMPLOYMENT":
      return t.entry.refusals.OUTSIDE_EMPLOYMENT;
    case "END_BEFORE_START":
      return words.END_BEFORE_START;
    case "END_IN_FUTURE":
      return words.endInFuture(error.now);
    case "OVERLAPS":
      return error.to === null
        ? words.overlapsOpenOwn(error.from)
        : words.overlapsOwn(error.from, error.to);
  }
}

/** The form's errors in words: the fields' in field order, and each break's by its id. */
export function entryMessages(
  errors: EntryErrors,
  draft: EntryDraft,
  t: Dictionary
): { fields: string[]; breaks: Record<string, string> } {
  const fields = [errors.businessDate, errors.startedAt, errors.endedAt]
    .map((error) => fieldMessage(error, t))
    .filter((text): text is string => text !== null);

  const breaks: Record<string, string> = {};
  for (const [id, error] of Object.entries(errors.breaks ?? {})) {
    if (error === "REQUIRED") continue;
    const other = draft.breaks.find((entry) => entry.id === errors.overlaps?.[id]);
    breaks[id] =
      error === "BREAK_OUTSIDE_SESSION" && draft.startedAt && draft.endedAt
        ? t.entry.errors.breakOutside(draft.startedAt, draft.endedAt)
        : error === "BREAK_OVERLAPS" && other
          ? t.entry.errors.breakOverlaps(other.startedAt, other.endedAt)
          : t.entry.refusals[error];
  }
  return { fields, breaks };
}

/**
 * The second narrow exception to "the phone never computes figures" (T-28, decided in T-40): the
 * draft is not on the server yet, so the backend cannot count it. Every other figure is the
 * backend's.
 */
export function entryPreview(
  draft: EntryDraft,
  context: {
    timezone: string | null;
    sessions: AttendanceSession[];
    month: AttendanceMonth | undefined;
  }
) {
  if (!context.month) return null;
  const { breakMinutes, breakThresholdMinutes } = context.month;
  return entryFigures(draft, {
    timezone: context.timezone,
    sessions: context.sessions,
    rules: { breakMinutes, breakThresholdMinutes },
  });
}

/** A business date as the date picker takes it: the phone's own midday, so no offset moves it. */
export function pickerDateOfDay(businessDate: string): Date {
  const [year = 1970, month = 1, day = 1] = businessDate.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function dayOfPickerDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
