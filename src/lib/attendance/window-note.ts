import type { Dictionary } from "@/i18n";

import {
  selfServiceMode,
  selfServiceVerdict,
  type SelfServiceMode,
  type SelfServiceWindow,
} from "./self-service";

export type WindowNote =
  | { kind: "hint"; mode: Exclude<SelfServiceMode, "OFF">; days: number }
  | { kind: "lock"; cause: "OFF" | "OUTSIDE" | "ENDED"; mode: SelfServiceMode; days: number };

/** What the foot of the Day view says about the Self-service window. A lapsed plan says nothing. */
export function windowNote({
  window,
  businessDate,
  today,
  active,
  employmentEnded,
}: {
  window: SelfServiceWindow | undefined;
  businessDate: string;
  today: string;
  active: boolean;
  employmentEnded: boolean;
}): WindowNote | null {
  if (!active || !window) return null;
  const mode = selfServiceMode(window);
  const days = window.days ?? 0;
  const verdict = selfServiceVerdict({ window, businessDate, today, open: false, employmentEnded });
  if (verdict !== "OPEN") return { kind: "lock", cause: verdict, mode, days };
  return mode === "OFF" ? null : { kind: "hint", mode, days };
}

/** The entry sheet's line under its date: how far back the window reaches. */
export function entryWindowHint(window: SelfServiceWindow, t: Dictionary): string {
  const mode = selfServiceMode(window);
  if (mode === "NO_LIMIT") return t.entry.hintNoLimit;
  if (mode === "DAYS") return t.entry.hintDays(window.days ?? 0);
  return t.entry.hintToday;
}

export function windowNoteText(note: WindowNote, t: Dictionary): string {
  const text = t.selfService;
  if (note.kind === "hint") {
    if (note.mode === "NO_LIMIT") return text.windowNoLimitHint;
    return note.mode === "DAYS" ? text.windowDaysHint(note.days) : text.windowZeroHint;
  }
  if (note.cause === "OFF") return text.windowOffNotice;
  if (note.cause === "ENDED") return text.windowEndedNotice;
  return note.mode === "DAYS"
    ? text.windowOutsideDaysNotice(note.days)
    : text.windowOutsideZeroNotice;
}
