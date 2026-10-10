import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { LaneMonth } from "@/components/calendar/lane-month";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarRange } from "@/lib/calendar/lanes";
import { isoDay } from "@/lib/requests/months";

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
    from: isoDay(OCTOBER, from),
    to: isoDay(OCTOBER, to),
    vacationIds: [`${id}-${from}`],
    names: [],
    pending: false,
    ...patch,
  } satisfies CalendarRange;
}

async function renderMonth(ranges: CalendarRange[], width = 390, month = OCTOBER) {
  const handlers = { onDay: jest.fn(), onBar: jest.fn(), onMore: jest.fn() };
  await render(
    <TranslationProvider>
      <LaneMonth
        month={month}
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
    expect(screen.queryByTestId("calendar-day-2026-09-30")).toBeNull();
    expect(screen.getByText("Mon")).toBeOnTheScreen();
  });

  it("renders the adjacent months' days with faded numbers, their month named on the first", async () => {
    await renderMonth([]);

    const first = screen.getByTestId("calendar-adjacent-day-2026-09-28");
    expect(first).toHaveTextContent("28Sep");
    expect(within(first).getByText("28")).toHaveStyle({ opacity: 0.55 });
    expect(screen.getByTestId("calendar-adjacent-day-2026-09-30")).toHaveTextContent("30", {
      exact: true,
    });
    expect(screen.getByTestId("calendar-adjacent-day-2026-11-01")).toHaveTextContent("1Nov");
    expect(within(screen.getByTestId("calendar-day-2026-10-05")).getByText("5")).not.toHaveStyle({
      opacity: 0.55,
    });
  });

  it("draws a seam where the month changes mid-week, and none on a Monday", async () => {
    await renderMonth([]);

    expect(screen.getByTestId("calendar-seam-2026-10-01")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-seam-2026-11-01")).toBeOnTheScreen();
  });

  it("draws no seam and no adjacent days for a month of whole weeks", async () => {
    await renderMonth([], 390, { year: 2027, month: 2 });

    expect(screen.queryByTestId(/^calendar-seam-/)).toBeNull();
    expect(screen.queryByTestId(/^calendar-adjacent-day-/)).toBeNull();
  });

  it("renders the December days before January of last year as numbers, tappable", async () => {
    const handlers = await renderMonth([], 390, { year: 2025, month: 1 });

    expect(screen.getByTestId("calendar-adjacent-day-2024-12-30")).toHaveTextContent("30Dec");
    expect(screen.getByTestId("calendar-adjacent-day-2024-12-31")).toHaveTextContent("31", {
      exact: true,
    });
    expect(screen.getByTestId("calendar-seam-2025-01-01")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("calendar-adjacent-day-2024-12-31"));
    expect(handlers.onDay).toHaveBeenCalledWith("2024-12-31");
  });

  it("calls back with a tapped adjacent day", async () => {
    const handlers = await renderMonth([]);

    await fireEvent.press(screen.getByTestId("calendar-adjacent-day-2026-11-01"));

    expect(handlers.onDay).toHaveBeenCalledWith("2026-11-01");
  });

  it("draws a booking on adjacent days at full strength, one bar across the month boundary", async () => {
    await renderMonth([
      { ...bar("eva", 1, 2, { status: "pending" }), from: "2026-09-29" },
      bar("tom", 1, 1, { from: "2026-11-01", to: "2026-11-01", vacationIds: ["tom-nov"] }),
    ]);

    expect(screen.getAllByTestId("calendar-bar-eva-1")).toHaveLength(1);
    expect(screen.getByTestId("calendar-bar-eva-1")).toHaveStyle({
      opacity: 1,
      borderStyle: "dashed",
    });
    expect(screen.getByTestId("calendar-bar-tom-nov")).toHaveStyle({ opacity: 1 });
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

  it("renders a pending bar dashed and an approved one solid", async () => {
    await renderMonth([bar("eva", 5, 5, { status: "pending" }), bar("tom", 12, 12)]);

    expect(screen.getByTestId("calendar-bar-eva-5")).toHaveStyle({ borderStyle: "dashed" });
    expect(screen.getByTestId("calendar-bar-tom-12")).toHaveStyle({ borderStyle: "solid" });
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

  it("renders a bar held by a change in flight faded, and takes its tap away", async () => {
    const handlers = await renderMonth([bar("eva", 5, 6, { pending: true })]);

    const held = screen.getByTestId("calendar-bar-eva-5");
    await fireEvent.press(held);

    expect(handlers.onBar).not.toHaveBeenCalled();
    expect(held).toBeDisabled();
    expect(held).toHaveStyle({ opacity: 0.55 });
  });
});
