// Ported from `flexi-day/lib/attendance/self-service.ts`; its tests came with it.
import { addDays } from "@/lib/days";

/** Off, `days` back, or no limit (`days: null`). */
export type SelfServiceWindow = { enabled: boolean; days: number | null };

/** The backend's refusal reasons, so the phone hides what the API would refuse. */
export type SelfServiceVerdict = "OPEN" | "OFF" | "OUTSIDE" | "ENDED";

export const MAX_DAY_LIMIT = 366;

export type SelfServiceMode = "OFF" | "NO_LIMIT" | "TODAY" | "DAYS";

export function selfServiceMode(window: SelfServiceWindow): SelfServiceMode {
  if (!window.enabled) return "OFF";
  if (window.days === null) return "NO_LIMIT";
  return window.days === 0 ? "TODAY" : "DAYS";
}

export type SelfServiceDraft = { enabled: boolean; noLimit: boolean; days: string };

export function selfServiceDaysOf(draft: SelfServiceDraft): number | null | undefined {
  return draft.noLimit ? null : parseDayLimit(draft.days);
}

export function selfServiceVerdict({
  window,
  businessDate,
  today,
  open,
  employmentEnded,
}: {
  window: SelfServiceWindow;
  businessDate: string;
  today: string;
  /** The day holds a session that is still running. */
  open: boolean;
  employmentEnded: boolean;
}): SelfServiceVerdict {
  if (employmentEnded) return "ENDED";
  if (!window.enabled) return "OFF";
  if (open) return "OPEN";
  if (businessDate > today) return "OUTSIDE";
  const start = windowStart(today, window.days);
  return start === null || businessDate >= start ? "OPEN" : "OUTSIDE";
}

/** Whether the reader's own day offers "Add session". */
export function entryOffered({
  window,
  today,
  active,
  employmentEnded,
  day,
}: {
  window: SelfServiceWindow;
  today: string;
  active: boolean;
  employmentEnded: boolean;
  day: { businessDate: string; upcoming: boolean; exclusion: { cause: string } | null };
}): boolean {
  if (!active || day.upcoming || day.exclusion?.cause === "NOT_EMPLOYED") return false;
  return (
    selfServiceVerdict({
      window,
      businessDate: day.businessDate,
      today,
      open: false,
      employmentEnded,
    }) === "OPEN"
  );
}

/** The earliest date inside the window, or null when it has no limit. */
export function windowStart(today: string, days: number | null): string | null {
  return days === null ? null : addDays(today, -days);
}

export function correctableUntil(businessDate: string, days: number | null): string | null {
  return days === null ? null : addDays(businessDate, days);
}

export function parseDayLimit(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const days = Number(trimmed);
  return days <= MAX_DAY_LIMIT ? days : undefined;
}

/** The calendar date an instant falls on in an IANA zone, as `YYYY-MM-DD`. */
export function businessDateIn(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: "year" | "month" | "day") =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
