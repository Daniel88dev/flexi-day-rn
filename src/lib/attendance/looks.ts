import type { Dictionary } from "@/i18n";

import type { ClockStatus } from "./clock";
import type { ClockAction } from "./notice";

type ClockText = {
  [K in keyof Dictionary["clock"]]: Dictionary["clock"][K] extends string ? K : never;
}[keyof Dictionary["clock"]];

export type ClockGlyph = "timer" | "clock" | "play" | "coffee" | "sign-in" | "sign-out";
export type ClockTone = "primary" | "ok" | "warm" | "muted";

export type StatusLook = {
  disc: { tone: ClockTone; glyph: ClockGlyph };
  /** Null when inactive: the lock notice takes the state line's place. */
  head: { tone: Exclude<ClockTone, "primary">; glyph: ClockGlyph; label: ClockText } | null;
  actions: { action: ClockAction; kind: "primary" | "secondary" }[];
};

/** Every place that shows the clock's state reads it here: the disc, the sheet and its actions. */
export const STATUS_LOOKS: Record<ClockStatus, StatusLook> = {
  out: {
    disc: { tone: "primary", glyph: "timer" },
    head: { tone: "muted", glyph: "clock", label: "notClockedIn" },
    actions: [{ action: "clock-in", kind: "primary" }],
  },
  in: {
    disc: { tone: "ok", glyph: "sign-out" },
    head: { tone: "ok", glyph: "play", label: "clockedIn" },
    actions: [
      { action: "break-start", kind: "secondary" },
      { action: "clock-out", kind: "primary" },
    ],
  },
  break: {
    disc: { tone: "warm", glyph: "coffee" },
    head: { tone: "warm", glyph: "coffee", label: "onBreak" },
    actions: [
      { action: "break-end", kind: "primary" },
      { action: "clock-out", kind: "secondary" },
    ],
  },
  inactive: {
    disc: { tone: "muted", glyph: "timer" },
    head: null,
    actions: [],
  },
};

export const ACTION_LOOKS: Record<
  ClockAction,
  { glyph: ClockGlyph; label: ClockText; busyLabel: ClockText }
> = {
  "clock-in": { glyph: "sign-in", label: "clockIn", busyLabel: "clockingIn" },
  "clock-out": { glyph: "sign-out", label: "clockOut", busyLabel: "clockingOut" },
  "break-start": { glyph: "coffee", label: "takeBreak", busyLabel: "startingBreak" },
  "break-end": { glyph: "play", label: "endBreak", busyLabel: "endingBreak" },
};
