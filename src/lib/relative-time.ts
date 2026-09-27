import type { Dictionary } from "@/i18n/en";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type AgeUnit = "seconds" | "minutes" | "hours" | "days";

/** How long ago something was, in the roughest unit that still says something. */
export type Age = { unit: AgeUnit; value: number };

export function ageMs(iso: string, now: number): number {
  return now - Date.parse(iso);
}

export function roughAge(ms: number): Age {
  if (ms < MINUTE) return { unit: "seconds", value: Math.max(0, Math.round(ms / 1000)) };
  if (ms < HOUR) return { unit: "minutes", value: Math.floor(ms / MINUTE) };
  if (ms < DAY) return { unit: "hours", value: Math.floor(ms / HOUR) };
  return { unit: "days", value: Math.floor(ms / DAY) };
}

const AGE_COPY: Record<AgeUnit, (t: Dictionary, value: number) => string> = {
  seconds: (t) => t.sync.justNow,
  minutes: (t, value) => t.sync.minutesAgo(value),
  hours: (t, value) => t.sync.hoursAgo(value),
  days: (t, value) => t.sync.daysAgo(value),
};

export function relativeAge(ms: number, t: Dictionary): string {
  const { unit, value } = roughAge(ms);
  return AGE_COPY[unit](t, value);
}
