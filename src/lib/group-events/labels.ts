import type { Dictionary } from "@/i18n/en";
import { dayParts } from "@/lib/calendar/day";
import { firstName } from "@/lib/viewer/viewer";

import { monthlyWeekdayPosition, weekdayOf, type RepeatRule } from "./occurrences";

const MONDAY_TO_FRIDAY = "0,1,2,3,4";

const dayMonthOf = (date: string) => ({
  day: Number(date.slice(8, 10)),
  month: Number(date.slice(5, 7)),
});

/** The rule in words, read off the start date: "Every 2 weeks on Tue, Thu, until 3 November 2026". */
export function ruleSummary(startDate: string, rule: RepeatRule, t: Dictionary): string {
  const labels = t.groupEvents.repeat;
  const n = rule.interval;
  let text: string;
  switch (rule.freq) {
    case "daily":
      text = labels.daily(n);
      break;
    case "weekly": {
      const days = [...rule.weekdays].sort((a, b) => a - b);
      text =
        n === 1 && days.join() === MONDAY_TO_FRIDAY
          ? labels.everyWeekday
          : labels.weekly(n, days.map((day) => t.calendar.weekdaysShort[day]).join(", "));
      break;
    }
    case "monthly": {
      const weekday = t.groupEvents.weekdaysLong[weekdayOf(startDate)];
      if (rule.monthlyMode === "weekday" || rule.monthlyMode === "lastWeekday") {
        const position = monthlyWeekdayPosition(startDate, rule);
        text =
          position === -1
            ? labels.monthlyOnLastWeekday(n, weekday)
            : labels.monthlyOnWeekday(n, position, weekday);
      } else {
        text = labels.monthlyOnDay(n, Number(startDate.slice(8, 10)));
      }
      break;
    }
    case "yearly":
      text = labels.yearly(n, t.groupEvents.dayMonth(dayMonthOf(startDate)));
      break;
  }
  return rule.until
    ? labels.until(
        text,
        t.groupEvents.fullDate({ ...dayMonthOf(rule.until), year: Number(rule.until.slice(0, 4)) })
      )
    : text;
}

function dayTitle(date: string, t: Dictionary): string {
  const { weekday, date: dayMonth } = dayParts(date);
  return t.calendar.dayTitle(weekday, dayMonth);
}

/** "09:30–09:45" or "All day"; a multi-day occurrence names its dates. */
export function timeLabel(
  event: { startDate: string; endDate: string; startTime: string | null; endTime: string | null },
  t: Dictionary
): string {
  const allDay = event.startTime === null || event.endTime === null;
  if (event.startDate === event.endDate) {
    return allDay ? t.groupEvents.allDay : `${event.startTime}–${event.endTime}`;
  }
  const start = dayTitle(event.startDate, t);
  const end = dayTitle(event.endDate, t);
  return allDay
    ? `${start} – ${end} · ${t.groupEvents.allDay}`
    : `${start} ${event.startTime} – ${end} ${event.endTime}`;
}

type Creator = { id: string; name: string; member: boolean } | null;

export function addedByLabel(creator: Creator, viewerId: string | null, t: Dictionary): string {
  if (!creator) return t.groupEvents.addedByFormerMember;
  return creator.id === viewerId ? t.groupEvents.addedByYou : t.groupEvents.addedBy(creator.name);
}

/** A creator who left keeps no rights (S2), so only the admins are named then. */
export function lockLabel(creator: Creator, t: Dictionary): string {
  return creator?.member
    ? t.groupEvents.lockedTo(firstName(creator.name, creator.name))
    : t.groupEvents.lockedToAdmins;
}
