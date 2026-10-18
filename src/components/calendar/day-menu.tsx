import { Link } from "expo-router";
import { createContext, use, useEffect, useRef, type ReactElement } from "react";

import { useTranslation } from "@/i18n/use-translation";
import { dayMenu } from "@/lib/group-events/day-menu";
import type { ShownGroupEvent } from "@/lib/group-events/rights";
import type { CalendarBirthday, CalendarGroupEvent } from "@/lib/local-store";

/**
 * iOS skips a modal presented while the context menu is still animating away, and the menu
 * reports no dismissal, so an action that opens one waits this long.
 */
export const MENU_DISMISS_MS = 700;

export type DayMenuActions = {
  canCreate: boolean;
  requestTimeOff: (date: string) => void;
  create: (date: string) => void;
  open: (event: CalendarGroupEvent, date: string) => void;
  edit: (event: CalendarGroupEvent) => void;
  remove: (event: CalendarGroupEvent) => void;
};

/** A month rendered without it, or while a screen reader runs, keeps plain day cells. */
export const DayMenuContext = createContext<DayMenuActions | null>(null);

/**
 * A day cell with the native context menu on long-press, the cell lifted as its preview.
 * The `href` is only there because `Link` needs one: a tap keeps the cell's own press.
 */
export function DayMenu({
  date,
  events,
  birthdays,
  children,
}: {
  date: string;
  events: readonly ShownGroupEvent[];
  birthdays: readonly CalendarBirthday[];
  children: ReactElement;
}) {
  const actions = use(DayMenuContext);
  const { t } = useTranslation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  if (!actions) return children;

  const afterMenu = (run: () => void) => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(run, MENU_DISMISS_MS);
  };

  const labels = t.groupEvents.menu;
  const menu = dayMenu({ date, events, birthdays, canCreate: actions.canCreate }, t);

  return (
    <Link
      href={{ pathname: "/requests/new", params: { date } }}
      asChild
      onPress={(event) => event.preventDefault()}
    >
      <Link.Trigger>{children}</Link.Trigger>
      <Link.Menu title={menu.title}>
        {menu.items.map((item) => {
          switch (item.kind) {
            case "requestTimeOff":
              return (
                <Link.MenuAction
                  key="request"
                  title={item.title}
                  icon="calendar.badge.plus"
                  onPress={() => actions.requestTimeOff(date)}
                />
              );
            case "newEvent":
              return (
                <Link.MenuAction
                  key="new"
                  title={item.title}
                  icon="star"
                  onPress={afterMenu(() => actions.create(date))}
                />
              );
            case "event":
              return (
                <Link.Menu
                  key={item.key}
                  title={item.title}
                  subtitle={item.subtitle}
                  icon="circle.fill"
                >
                  <Link.MenuAction
                    title={labels.open}
                    icon="info.circle"
                    onPress={afterMenu(() => actions.open(item.event, date))}
                  />
                  {item.locked === null ? (
                    // Link.Menu keeps only its direct action and menu children, so no fragment.
                    [
                      <Link.MenuAction
                        key="edit"
                        title={labels.edit}
                        icon="pencil"
                        onPress={afterMenu(() => actions.edit(item.event))}
                      />,
                      <Link.MenuAction
                        key="delete"
                        title={labels.delete}
                        icon="trash"
                        destructive
                        onPress={afterMenu(() => actions.remove(item.event))}
                      />,
                    ]
                  ) : (
                    <Link.MenuAction
                      title={labels.editOrDelete}
                      subtitle={item.locked}
                      icon="lock"
                      disabled
                    />
                  )}
                </Link.Menu>
              );
            case "birthday":
              return (
                <Link.MenuAction key={item.key} title={item.title} icon="birthday.cake" disabled />
              );
          }
        })}
      </Link.Menu>
    </Link>
  );
}
