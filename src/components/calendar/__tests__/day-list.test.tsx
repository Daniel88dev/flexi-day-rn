import { fireEvent, render, screen } from "@testing-library/react-native";

import { DayList } from "@/components/calendar/day-list";
import { TranslationProvider } from "@/i18n/use-translation";
import type { DayEntry } from "@/lib/calendar/day";

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

async function renderList(entries: DayEntry[], holidays: string[] = []) {
  const handlers = { onOpen: jest.fn(), onBook: jest.fn() };
  await render(
    <TranslationProvider>
      <DayList day="2026-10-14" entries={entries} holidays={holidays} viewerId="me" {...handlers} />
    </TranslationProvider>
  );
  return handlers;
}

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
});
