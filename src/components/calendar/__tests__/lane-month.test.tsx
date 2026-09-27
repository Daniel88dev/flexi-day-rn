import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { LaneMonth } from "@/components/calendar/lane-month";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarRange } from "@/lib/calendar/lanes";

const OCTOBER = { year: 2026, month: 10 };
const VIEWER = "me";

function bar(id: string, from: number, to: number, patch: Partial<CalendarRange> = {}) {
  return {
    id,
    userId: id,
    userName: `${id[0].toUpperCase()}${id.slice(1)} Novak`,
    type: "VACATION",
    status: "approved",
    halfDay: false,
    from,
    to,
    vacationIds: [`${id}-${from}`],
    names: [],
    ...patch,
  } satisfies CalendarRange;
}

async function renderMonth(ranges: CalendarRange[], width = 390) {
  const handlers = { onDay: jest.fn(), onBar: jest.fn(), onMore: jest.fn() };
  await render(
    <TranslationProvider>
      <LaneMonth
        month={OCTOBER}
        ranges={ranges}
        width={width}
        viewerId={VIEWER}
        today="2026-10-14"
        {...handlers}
      />
    </TranslationProvider>
  );
  return handlers;
}

describe("LaneMonth", () => {
  it("renders a cell for every day of the month, Monday first", async () => {
    await renderMonth([]);

    expect(screen.getByTestId("calendar-month-2026-10")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-day-2026-10-01")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-day-2026-10-31")).toBeOnTheScreen();
    expect(screen.queryByTestId("calendar-day-2026-11-01")).toBeNull();
    expect(screen.getByText("Mon")).toBeOnTheScreen();
  });

  it("renders the viewer's own bar as You, a half day with ½", async () => {
    await renderMonth([bar(VIEWER, 5, 6), bar("eva", 7, 7, { halfDay: true })]);

    expect(screen.getByTestId(`calendar-bar-${VIEWER}-5`)).toHaveTextContent(/You$/);
    expect(screen.getByTestId("calendar-bar-eva-7")).toHaveTextContent("Eva ½");
  });

  it("renders the avatar only on a bar wide enough for it", async () => {
    await renderMonth([bar("ada", 5, 6), bar("bob", 8, 8)]);

    expect(screen.getByTestId("calendar-bar-ada-5")).toHaveTextContent("ANAda");
    expect(screen.getByTestId("calendar-bar-bob-8")).toHaveTextContent("Bob");
  });

  it("renders a pending bar dashed, without the solid edge an approved one has", async () => {
    await renderMonth([bar("eva", 5, 5, { status: "pending" }), bar("tom", 12, 12)]);

    const pending = screen.getByTestId("calendar-bar-eva-5");
    expect(pending).toHaveStyle({ borderStyle: "dashed" });
    expect(within(pending).queryByTestId("calendar-bar-edge")).toBeNull();
    expect(screen.getByTestId("calendar-bar-tom-12")).toHaveStyle({ borderStyle: "solid" });
    expect(
      within(screen.getByTestId("calendar-bar-tom-12")).getByTestId("calendar-bar-edge")
    ).toBeOnTheScreen();
  });

  it("renders the bars past two lanes as +N on each day they cover, the viewer's kept", async () => {
    const handlers = await renderMonth([
      bar("ada", 12, 16),
      bar("bob", 12, 16),
      bar(VIEWER, 14, 14),
    ]);

    expect(screen.getByTestId(`calendar-bar-${VIEWER}-14`)).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-bar-ada-12")).toBeOnTheScreen();
    expect(screen.queryByTestId("calendar-bar-bob-12")).toBeNull();
    expect(screen.getByTestId("calendar-more-2026-10-14")).toHaveTextContent("+1");

    await fireEvent.press(screen.getByTestId("calendar-more-2026-10-14"));
    expect(handlers.onMore).toHaveBeenCalledWith("2026-10-14");
  });

  it("renders a run of bank holidays as one pill carrying their names", async () => {
    const holiday = bar("bank", 28, 29, {
      userId: null,
      userName: null,
      type: "BANK_HOLIDAY",
      vacationIds: [],
      names: ["Statehood", "Freedom"],
    });
    const handlers = await renderMonth([holiday]);

    const pill = screen.getByTestId("calendar-holiday-2026-10-28");
    expect(pill).toHaveTextContent("Statehood, Freedom");

    await fireEvent.press(pill);
    expect(handlers.onMore).toHaveBeenCalledWith("2026-10-28");
  });

  it("calls back with the tapped day and the first vacation of a tapped bar", async () => {
    const handlers = await renderMonth([bar("eva", 5, 6)]);

    await fireEvent.press(screen.getByTestId("calendar-day-2026-10-20"));
    await fireEvent.press(screen.getByTestId("calendar-bar-eva-5"));

    expect(handlers.onDay).toHaveBeenCalledWith("2026-10-20");
    expect(handlers.onBar).toHaveBeenCalledWith("eva-5");
  });
});
