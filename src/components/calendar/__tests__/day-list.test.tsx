import { fireEvent, render, screen } from "@testing-library/react-native";

import { DayList } from "@/components/calendar/day-list";
import { TranslationProvider } from "@/i18n/use-translation";
import type { DayEntry } from "@/lib/calendar/day";
import type { CalendarBirthday, CalendarGroupEvent } from "@/lib/local-store";

const ENTRY: DayEntry = {
  vacationId: "v-eva",
  userId: "eva",
  userName: "Eva Novak",
  type: "SICK",
  status: "pending",
  halfDay: true,
  from: "2026-10-13",
  to: "2026-10-15",
  pending: false,
};

async function renderList(
  entries: DayEntry[],
  holidays: string[] = [],
  birthdays: CalendarBirthday[] = [],
  events: CalendarGroupEvent[] = []
) {
  const handlers = {
    onOpen: jest.fn(),
    onBook: jest.fn(),
    onSettings: jest.fn(),
    onEvent: jest.fn(),
  };
  await render(
    <TranslationProvider>
      <DayList
        day="2026-10-14"
        entries={entries}
        holidays={holidays}
        birthdays={birthdays}
        events={events}
        viewerId="me"
        {...handlers}
      />
    </TranslationProvider>
  );
  return handlers;
}

const birthday = (patch: Partial<CalendarBirthday>): CalendarBirthday => ({
  userId: "petra",
  userName: "Petra Svoboda",
  date: "2026-10-14",
  age: 34,
  own: false,
  ...patch,
});

const groupEvent = (patch: Partial<CalendarGroupEvent>): CalendarGroupEvent => ({
  id: "standup",
  groupId: "g-design",
  groupName: "Design",
  title: "Weekly standup",
  note: null,
  startDate: "2026-10-14",
  endDate: "2026-10-14",
  startTime: "09:30",
  endTime: "09:45",
  ruleStartDate: "2026-10-07",
  repeat: { freq: "weekly", interval: 1, weekdays: [2], monthlyMode: null, until: null },
  changedOnce: false,
  creator: { id: "eva", name: "Eva Novak", member: true },
  canEdit: false,
  ...patch,
});

describe("DayList", () => {
  it("renders each person with their type, half day, span and a pending badge", async () => {
    await renderList([ENTRY]);

    const row = screen.getByTestId("day-list-row-v-eva");
    expect(row).toHaveTextContent(/Eva Novak/);
    expect(row).toHaveTextContent(/Sick · Half day · 13-15 Oct/);
    expect(row).toHaveTextContent(/Pending/);
    expect(screen.getByText("1 away or remote")).toBeOnTheScreen();
  });

  it("renders the viewer as You and the day's bank holidays above everyone", async () => {
    await renderList([{ ...ENTRY, userId: "me", status: "approved" }], ["Statehood"]);

    const row = screen.getByTestId("day-list-row-v-eva");
    expect(row).toHaveTextContent(/You/);
    expect(row).not.toHaveTextContent(/Eva Novak/);
    expect(screen.getByText("Statehood")).toBeOnTheScreen();
  });

  it("renders the day's birthdays by first name, with the age turned that day", async () => {
    await renderList(
      [ENTRY],
      [],
      [
        birthday({}),
        birthday({ userId: "tomas", userName: "Tomáš Dvořák", age: null }),
        birthday({ userId: "me", userName: "Dana Holt", age: 38, own: true }),
      ]
    );

    expect(screen.getByTestId("day-list-birthday-petra")).toHaveTextContent("Petra turns 34");
    expect(screen.getByTestId("day-list-birthday-tomas")).toHaveTextContent("Tomáš's birthday");
    expect(screen.getByTestId("day-list-birthday-me")).toHaveTextContent(/Your birthday · 38/);
    expect(screen.getByText("1 away or remote")).toBeOnTheScreen();
  });

  it("opens Settings from the viewer's own birthday, and from nobody else's", async () => {
    const { onSettings } = await renderList(
      [],
      [],
      [birthday({}), birthday({ userId: "me", userName: "Dana Holt", age: null, own: true })]
    );

    expect(screen.getByTestId("day-list-birthday-me")).toHaveTextContent(/^Your birthday/);
    await fireEvent.press(screen.getByTestId("day-list-birthday-petra"));
    expect(onSettings).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("day-list-birthday-me"));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it("offers New group event under Book only when given a way to create one", async () => {
    await renderList([]);
    expect(screen.queryByTestId("day-list-new-event")).toBeNull();

    const onNewEvent = jest.fn();
    await render(
      <TranslationProvider>
        <DayList
          day="2026-10-14"
          entries={[]}
          holidays={[]}
          viewerId="me"
          onBook={jest.fn()}
          onNewEvent={onNewEvent}
        />
      </TranslationProvider>
    );
    await fireEvent.press(screen.getByTestId("day-list-new-event"));

    expect(onNewEvent).toHaveBeenCalledWith("2026-10-14");
  });

  it("renders Nobody is away and still offers to book the day", async () => {
    const { onBook } = await renderList([]);

    expect(screen.getByText("Nobody is away")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Book Wed 14 Oct"));
    expect(onBook).toHaveBeenCalledWith("2026-10-14");
  });

  it("calls back with the vacation of a tapped row", async () => {
    const { onOpen } = await renderList([ENTRY]);

    await fireEvent.press(screen.getByTestId("day-list-row-v-eva"));

    expect(onOpen).toHaveBeenCalledWith("v-eva");
  });

  it("renders a row held by a change in flight as Sending, and takes its tap away", async () => {
    const { onOpen } = await renderList([
      { ...ENTRY, vacationId: "pending-1:2026-10-14", pending: true },
    ]);

    const row = screen.getByTestId("day-list-row-pending-1:2026-10-14");
    await fireEvent.press(row);

    expect(onOpen).not.toHaveBeenCalled();
    expect(row).toBeDisabled();
    expect(row).toHaveTextContent(/Sending…/);
  });

  describe("with group events", () => {
    const offsite = groupEvent({
      id: "offsite",
      groupName: "Platform",
      title: "Team offsite",
      note: "Bring boots",
      startDate: "2026-10-13",
      endDate: "2026-10-15",
      startTime: null,
      endTime: null,
      repeat: null,
      ruleStartDate: "2026-10-13",
      creator: { id: "me", name: "Dana Holt", member: true },
      canEdit: true,
    });

    it("lists the day's events under Group events, then birthdays, above Away", async () => {
      await renderList([ENTRY], ["Statehood"], [birthday({})], [groupEvent({}), offsite]);

      expect(screen.getByTestId("day-list")).toHaveTextContent(
        /Group events.*Weekly standup.*Team offsite.*Petra turns 34.*Away.*Statehood.*Eva Novak/
      );
    });

    it("renders a card's time, rule, note and who added it to which group", async () => {
      await renderList([], [], [], [groupEvent({}), offsite]);

      expect(screen.getByTestId("day-list-event-standup-2026-10-14")).toHaveTextContent(
        /09:30–09:45 · Every week on Wed.*Added by Eva Novak · Design/
      );
      expect(screen.getByTestId("day-list-event-offsite-2026-10-13")).toHaveTextContent(
        /Tue 13 Oct – Thu 15 Oct · All day.*Bring boots.*Added by you · Platform/
      );
    });

    it("shows the lock line on a card the viewer cannot change, and none on one they can", async () => {
      await renderList([], [], [], [groupEvent({}), offsite]);

      expect(screen.getByTestId("day-list-event-standup-2026-10-14")).toHaveTextContent(
        /Only Eva or a group admin can change this/
      );
      expect(screen.getByTestId("day-list-event-offsite-2026-10-13")).not.toHaveTextContent(
        /can change this/
      );
    });

    it("calls back with the tapped event", async () => {
      const { onEvent } = await renderList([], [], [], [groupEvent({})]);

      await fireEvent.press(screen.getByTestId("day-list-event-standup-2026-10-14"));

      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "standup" }));
    });

    it("offers Edit and Delete on an editor's card only, handing over the event", async () => {
      const onEditEvent = jest.fn();
      const onDeleteEvent = jest.fn();
      await render(
        <TranslationProvider>
          <DayList
            day="2026-10-14"
            entries={[]}
            holidays={[]}
            events={[groupEvent({}), groupEvent({ id: "retro", title: "Retro", canEdit: true })]}
            viewerId="me"
            onBook={jest.fn()}
            onEditEvent={onEditEvent}
            onDeleteEvent={onDeleteEvent}
          />
        </TranslationProvider>
      );

      expect(screen.queryByTestId("day-list-event-standup-2026-10-14-edit")).toBeNull();
      await fireEvent.press(screen.getByTestId("day-list-event-retro-2026-10-14-edit"));
      await fireEvent.press(screen.getByTestId("day-list-event-retro-2026-10-14-delete"));

      expect(onEditEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "retro" }));
      expect(onDeleteEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "retro" }));
    });

    it("leaves the headings out on a day without events or birthdays", async () => {
      await renderList([ENTRY]);

      expect(screen.queryByText("Group events")).toBeNull();
      expect(screen.queryByText("Away")).toBeNull();
    });
  });
});
