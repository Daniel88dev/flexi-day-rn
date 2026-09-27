import type { Dictionary } from "@/i18n";

import { clockStatusOf, minutesBetween, type ClockView } from "./clock";
import { formatMinutes } from "./format";
import { STATUS_LOOKS, type StatusLook } from "./looks";

export type DiscFace = StatusLook["disc"] & {
  label: string;
  offline: boolean;
  loading: boolean;
};

/** The tab bar's centre disc. Null keeps the slot empty: without an Employment there is no clock. */
export function discFace(view: ClockView, now: number, t: Dictionary): DiscFace | null {
  if (view.kind === "no-employment") return null;
  if (view.kind !== "ready") {
    return {
      ...STATUS_LOOKS.out.disc,
      label: t.nav.clock,
      offline: view.kind === "unreachable",
      loading: view.kind === "loading",
    };
  }

  const status = clockStatusOf(view.state);
  const open = view.state.openSession;
  const label =
    status === "in" && open
      ? formatMinutes(minutesBetween(open.startedAt, now))
      : status === "break"
        ? t.clock.onBreak
        : t.nav.clock;
  return { ...STATUS_LOOKS[status].disc, label, offline: view.offline, loading: false };
}
