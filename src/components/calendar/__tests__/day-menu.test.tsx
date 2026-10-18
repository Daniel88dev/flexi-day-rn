import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { Pressable } from "react-native";

import { DayMenu, DayMenuContext, MENU_DISMISS_MS, type DayMenuActions } from "../day-menu";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarBirthday, CalendarGroupEvent } from "@/lib/local-store";

jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  Link: jest.requireActual("@/test-support/link-menu").FakeLink,
}));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const event = (patch: Partial<CalendarGroupEvent>): CalendarGroupEvent => ({
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
  creator: { id: "bob", name: "Bob Dvorak", member: true },
  canEdit: true,
  ...patch,
});

const PETRA: CalendarBirthday = {
  userId: "petra",
  userName: "Petra Malá",
  date: "2026-10-21",
  age: 34,
  own: false,
};

function actions(patch: Partial<DayMenuActions> = {}): DayMenuActions {
  return {
    canCreate: true,
    requestTimeOff: jest.fn(),
    create: jest.fn(),
    open: jest.fn(),
    edit: jest.fn(),
    remove: jest.fn(),
    ...patch,
  };
}

async function renderDay({
  value,
  events = [],
  birthdays = [],
}: {
  value: DayMenuActions | null;
  events?: CalendarGroupEvent[];
  birthdays?: CalendarBirthday[];
}) {
  const onDay = jest.fn();
  await render(
    <TranslationProvider>
      <DayMenuContext value={value}>
        <DayMenu date="2026-10-21" events={events} birthdays={birthdays}>
          <Pressable testID="calendar-day-2026-10-21" onPress={onDay} />
        </DayMenu>
      </DayMenuContext>
    </TranslationProvider>
  );
  return onDay;
}

const item = (title: string) =>
  within(screen.getByTestId("link-menu")).getByRole("menuitem", { name: title });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("DayMenu", () => {
  it("keeps a tap on the day doing what it did", async () => {
    const onDay = await renderDay({ value: actions() });

    await fireEvent.press(screen.getByTestId("calendar-day-2026-10-21"));

    expect(onDay).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("link-menu")).toBeNull();
  });

  it("opens the day's menu on a long-press, events and birthdays included", async () => {
    await renderDay({ value: actions(), events: [event({})], birthdays: [PETRA] });

    await fireEvent(screen.getByTestId("calendar-day-2026-10-21"), "longPress");

    const menu = screen.getByTestId("link-menu");
    expect(within(menu).getByText("Wed 21 Oct")).toBeOnTheScreen();
    expect(item("Request time off")).toBeOnTheScreen();
    expect(item("New group event")).toBeOnTheScreen();
    expect(within(menu).getByLabelText("Standup")).toHaveProp("accessibilityHint", "09:30–09:45");
    expect(item("Open")).toBeOnTheScreen();
    expect(item("Edit…")).toBeEnabled();
    expect(item("Delete…")).toBeEnabled();
    expect(item("Petra turns 34")).toBeDisabled();
  });

  it("shows a non-editor Open and the locked row, and no New group event without the plan", async () => {
    await renderDay({ value: actions({ canCreate: false }), events: [event({ canEdit: false })] });

    await fireEvent(screen.getByTestId("calendar-day-2026-10-21"), "longPress");

    expect(item("Open")).toBeEnabled();
    expect(item("Edit or delete")).toBeDisabled();
    expect(item("Edit or delete")).toHaveProp(
      "accessibilityHint",
      "Only Bob or a group admin can change this"
    );
    const menu = screen.getByTestId("link-menu");
    expect(within(menu).queryByRole("menuitem", { name: "New group event" })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: "Edit…" })).toBeNull();
  });

  it("opens the editor only once the menu has finished dismissing", async () => {
    const value = actions();
    await renderDay({ value });
    await fireEvent(screen.getByTestId("calendar-day-2026-10-21"), "longPress");

    await fireEvent.press(item("New group event"));

    expect(value.create).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(MENU_DISMISS_MS));
    expect(value.create).toHaveBeenCalledWith("2026-10-21");
  });

  it("hands the event to Open, Edit and Delete after the menu dismisses", async () => {
    const value = actions();
    const standup = event({});
    await renderDay({ value, events: [standup] });

    for (const [title, action] of [
      ["Open", value.open],
      ["Edit…", value.edit],
      ["Delete…", value.remove],
    ] as const) {
      await fireEvent(screen.getByTestId("calendar-day-2026-10-21"), "longPress");
      await fireEvent.press(item(title));
      await act(() => jest.advanceTimersByTime(MENU_DISMISS_MS));
      expect(action).toHaveBeenCalledWith(standup, ...(title === "Open" ? ["2026-10-21"] : []));
    }
  });

  it("requests time off on the day at once, since that is a route", async () => {
    const value = actions();
    await renderDay({ value });
    await fireEvent(screen.getByTestId("calendar-day-2026-10-21"), "longPress");

    await fireEvent.press(item("Request time off"));

    expect(value.requestTimeOff).toHaveBeenCalledWith("2026-10-21");
  });

  it("renders the day alone without the dashboard's actions", async () => {
    const onDay = await renderDay({ value: null });

    await fireEvent(screen.getByTestId("calendar-day-2026-10-21"), "longPress");
    await fireEvent.press(screen.getByTestId("calendar-day-2026-10-21"));

    expect(screen.queryByTestId("link-menu")).toBeNull();
    expect(onDay).toHaveBeenCalledTimes(1);
  });
});
