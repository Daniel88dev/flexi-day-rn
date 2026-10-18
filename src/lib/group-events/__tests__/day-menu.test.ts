import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import type { CalendarBirthday } from "@/lib/local-store";

import { dayItemsOf, dayMenu } from "../day-menu";
import type { ShownGroupEvent } from "../rights";

const event = (patch: Partial<ShownGroupEvent>): ShownGroupEvent => ({
  id: "ge-1",
  groupId: "g-1",
  groupName: "Dev Team",
  title: "Standup",
  note: null,
  startDate: "2026-10-21",
  endDate: "2026-10-21",
  startTime: "09:30",
  endTime: "09:45",
  repeat: null,
  ruleStartDate: "2026-10-21",
  changedOnce: false,
  creator: { id: "bob", name: "Bob Dvorak" },
  canEdit: true,
  ...patch,
});

const birthday = (patch: Partial<CalendarBirthday>): CalendarBirthday => ({
  userId: "petra",
  userName: "Petra Malá",
  date: "2026-10-21",
  age: 34,
  own: false,
  ...patch,
});

describe("dayMenu", () => {
  it("returns the day as its title, then Request time off and New group event", () => {
    const menu = dayMenu({ date: "2026-10-21", events: [], birthdays: [], canCreate: true }, en);
    expect(menu.title).toBe("Wed 21 Oct");
    expect(menu.items).toEqual([
      { kind: "requestTimeOff", title: "Request time off" },
      { kind: "newEvent", title: "New group event" },
    ]);
  });

  it("returns no New group event without canCreate", () => {
    const menu = dayMenu({ date: "2026-10-21", events: [], birthdays: [], canCreate: false }, en);
    expect(menu.items.map((item) => item.kind)).toEqual(["requestTimeOff"]);
  });

  it("returns an editor's event with its time and no lock", () => {
    const standup = event({});
    const menu = dayMenu(
      { date: "2026-10-21", events: [standup], birthdays: [], canCreate: true },
      en
    );
    expect(menu.items[2]).toEqual({
      kind: "event",
      key: "ge-1-2026-10-21",
      event: standup,
      title: "Standup",
      subtitle: "09:30–09:45",
      locked: null,
    });
  });

  it("returns a non-editor's event locked to its creator", () => {
    const menu = dayMenu(
      {
        date: "2026-10-21",
        events: [event({ canEdit: false, startTime: null, endTime: null })],
        birthdays: [],
        canCreate: false,
      },
      en
    );
    expect(menu.items[1]).toMatchObject({
      kind: "event",
      subtitle: "All day",
      locked: "Only Bob or a group admin can change this",
    });
  });

  it("returns the day's birthdays last, as their labels", () => {
    const menu = dayMenu(
      {
        date: "2026-10-21",
        events: [event({})],
        birthdays: [birthday({}), birthday({ userId: "me", userName: "Dana Holt", own: true })],
        canCreate: true,
      },
      en
    );
    expect(menu.items.slice(3)).toEqual([
      { kind: "birthday", key: "petra", title: "Petra turns 34" },
      { kind: "birthday", key: "me", title: "Your birthday · 34" },
    ]);
  });

  it("returns Czech copy", () => {
    const menu = dayMenu({ date: "2026-10-21", events: [], birthdays: [], canCreate: true }, cs);
    expect(menu.items.map((item) => item.title)).toEqual([
      "Požádat o volno",
      "Nová skupinová událost",
    ]);
  });
});

describe("dayItemsOf", () => {
  it("returns each day's events and birthdays, a multi-day event on every day it covers", () => {
    const offsite = event({ id: "ge-2", startDate: "2026-10-21", endDate: "2026-10-23" });
    const standup = event({ startDate: "2026-10-22", endDate: "2026-10-22" });
    const items = dayItemsOf({ events: [offsite, standup], birthdays: [birthday({})] });

    expect(items.get("2026-10-21")).toEqual({ events: [offsite], birthdays: [birthday({})] });
    expect(items.get("2026-10-22")).toEqual({ events: [offsite, standup], birthdays: [] });
    expect(items.get("2026-10-23")).toEqual({ events: [offsite], birthdays: [] });
    expect(items.get("2026-10-24")).toBeUndefined();
  });
});
