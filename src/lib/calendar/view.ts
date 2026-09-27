import type { MySettings } from "@/lib/query";

export type CalendarView = "lanes" | "stripes";

type StoredView = MySettings["dashboardCalendarView"];

/**
 * Lanes until `/me/settings` first answers, which on an offline cold start is never, since the
 * query cache lives in memory. After that it is the last answer, even while a later read fails:
 * the stored scope works the same way, and dropping to lanes on a transient failure would flicker.
 */
export function calendarView(
  settings: Pick<MySettings, "dashboardCalendarView"> | undefined
): CalendarView {
  return settings?.dashboardCalendarView === "STRIPES" ? "stripes" : "lanes";
}

export function storedCalendarView(view: CalendarView): StoredView {
  return view === "stripes" ? "STRIPES" : "LANES";
}
