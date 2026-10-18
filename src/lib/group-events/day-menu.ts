import type { Dictionary } from "@/i18n/en";
import { birthdayLabel } from "@/lib/calendar/birthday-label";
import { dayParts } from "@/lib/calendar/day";
import { addDays } from "@/lib/days";
import type { CalendarBirthday } from "@/lib/local-store";

import { lockLabel, timeLabel } from "./labels";
import type { ShownGroupEvent } from "./rights";

export type DayMenuItem =
  | { kind: "requestTimeOff"; title: string }
  | { kind: "newEvent"; title: string }
  | {
      kind: "event";
      key: string;
      event: ShownGroupEvent;
      title: string;
      subtitle: string;
      /** Why a non-editor cannot edit or delete; null for an editor. */
      locked: string | null;
    }
  | { kind: "birthday"; key: string; title: string };

/**
 * The long-press menu of one day: Request time off, New group event while a group may take
 * one, a submenu per group event, then the day's birthdays as rows that do nothing.
 */
export function dayMenu(
  {
    date,
    events,
    birthdays,
    canCreate,
  }: {
    date: string;
    events: readonly ShownGroupEvent[];
    birthdays: readonly CalendarBirthday[];
    canCreate: boolean;
  },
  t: Dictionary
): { title: string; items: DayMenuItem[] } {
  const { weekday, date: dayMonth } = dayParts(date);
  const labels = t.groupEvents.menu;
  const items: DayMenuItem[] = [{ kind: "requestTimeOff", title: labels.requestTimeOff }];
  if (canCreate) items.push({ kind: "newEvent", title: labels.newGroupEvent });
  for (const event of events) {
    items.push({
      kind: "event",
      key: `${event.id}-${event.startDate}`,
      event,
      title: event.title,
      subtitle: timeLabel(event, t),
      locked: event.canEdit ? null : lockLabel(event.creator, t),
    });
  }
  for (const birthday of birthdays) {
    items.push({ kind: "birthday", key: birthday.userId, title: birthdayLabel(birthday, t) });
  }
  return { title: t.calendar.dayTitle(weekday, dayMonth), items };
}

export type DayItems = {
  events: readonly ShownGroupEvent[];
  birthdays: readonly CalendarBirthday[];
};

/** A month's group events and birthdays by day, for each day's menu. */
export function dayItemsOf({
  events,
  birthdays,
}: {
  events: readonly ShownGroupEvent[];
  birthdays: readonly CalendarBirthday[];
}): Map<string, DayItems> {
  const byDay = new Map<string, { events: ShownGroupEvent[]; birthdays: CalendarBirthday[] }>();
  const on = (date: string) => {
    const items = byDay.get(date) ?? { events: [], birthdays: [] };
    byDay.set(date, items);
    return items;
  };
  for (const event of events) {
    for (let date = event.startDate; date <= event.endDate; date = addDays(date, 1)) {
      on(date).events.push(event);
    }
  }
  for (const birthday of birthdays) on(birthday.date).birthdays.push(birthday);
  return byDay;
}
