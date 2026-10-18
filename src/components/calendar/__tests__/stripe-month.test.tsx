import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { StripeMonth, stripeMonthHeight } from "@/components/calendar/stripe-month";
import { TranslationProvider } from "@/i18n/use-translation";
import type { DayMarks } from "@/lib/calendar/day-mark";
import type { CalendarRange } from "@/lib/calendar/lanes";
import { isoDay } from "@/lib/requests/months";

const OCTOBER = { year: 2026, month: 10 };
const VIEWER = "me";

function stripe(id: string, from: number, to: number, patch: Partial<CalendarRange> = {}) {
  return {
    id,
    userId: id,
    userName: `${id} Novak`,
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

const holiday = (day: number, name: string): CalendarRange => ({
  ...stripe(`bank|${day}`, day, day, { type: "BANK_HOLIDAY", names: [name] }),
  userId: null,
  userName: null,
  vacationIds: [],
});

async function renderMonth(
  ranges: CalendarRange[],
  selected = "2026-10-14",
  month = OCTOBER,
  marks?: DayMarks
) {
  const onDay = jest.fn();
  await render(
    <TranslationProvider>
      <StripeMonth
        month={month}
        ranges={ranges}
        width={390}
        viewerId={VIEWER}
        today="2026-10-14"
        selected={selected}
        marks={marks}
        onDay={onDay}
      />
    </TranslationProvider>
  );
  return onDay;
}

describe("StripeMonth", () => {
  it("names a day's birthdays on its cell, and on no other day", async () => {
    await renderMonth(
      [],
      "2026-10-14",
      OCTOBER,
      new Map([["2026-10-20", { birthdays: 2, events: 0 }]])
    );

    expect(screen.getByTestId("calendar-day-2026-10-20")).toHaveProp(
      "accessibilityLabel",
      "Tue 20 Oct, 2 birthdays"
    );
    expect(screen.getByTestId("calendar-day-2026-10-21")).toHaveProp(
      "accessibilityLabel",
      "Wed 21 Oct"
    );
  });

  it("renders a cell for every day of the month and selects a tapped one", async () => {
    const onDay = await renderMonth([]);

    expect(screen.getByTestId("calendar-month-2026-10")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-day-2026-10-01")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-day-2026-10-31")).toBeOnTheScreen();
    expect(screen.queryByTestId("calendar-day-2026-09-30")).toBeNull();
    await fireEvent.press(screen.getByTestId("calendar-day-2026-10-20"));

    expect(onDay).toHaveBeenCalledWith("2026-10-20");
  });

  it("renders the adjacent months' days with faded numbers, their month captioned on the first", async () => {
    await renderMonth([]);

    const first = screen.getByTestId("calendar-adjacent-day-2026-09-28");
    expect(first).toHaveTextContent("Sep28");
    expect(within(first).getByText("28")).toHaveStyle({ opacity: 0.55 });
    expect(screen.getByTestId("calendar-adjacent-day-2026-09-29")).toHaveTextContent("29", {
      exact: true,
    });
    expect(screen.getByTestId("calendar-adjacent-day-2026-11-01")).toHaveTextContent("Nov1");
    expect(screen.getByTestId("calendar-adjacent-day-2026-11-01")).toHaveAccessibleName(
      "Sun 1 Nov"
    );
  });

  it("renders the December days before January of last year as numbers, tappable", async () => {
    const onDay = await renderMonth([], "2025-01-01", { year: 2025, month: 1 });

    expect(screen.getByTestId("calendar-adjacent-day-2024-12-30")).toHaveTextContent("Dec30");
    expect(screen.getByTestId("calendar-adjacent-day-2024-12-31")).toHaveTextContent("31", {
      exact: true,
    });

    await fireEvent.press(screen.getByTestId("calendar-adjacent-day-2024-12-31"));
    expect(onDay).toHaveBeenCalledWith("2024-12-31");
  });

  it("draws a seam where the month changes mid-week", async () => {
    await renderMonth([]);

    expect(screen.getByTestId("calendar-seam-2026-10-01")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-seam-2026-11-01")).toBeOnTheScreen();
  });

  it("selects a tapped adjacent day and shows it at full strength", async () => {
    const onDay = await renderMonth([], "2026-11-01");

    const selected = screen.getByTestId("calendar-adjacent-day-2026-11-01");
    expect(selected).toBeSelected();
    expect(within(selected).getByText("1")).not.toHaveStyle({ opacity: 0.55 });

    await fireEvent.press(screen.getByTestId("calendar-adjacent-day-2026-09-30"));
    expect(onDay).toHaveBeenCalledWith("2026-09-30");
  });

  it("draws a stripe on adjacent days at full strength, one stripe across the month boundary", async () => {
    await renderMonth([{ ...stripe("eva", 1, 2), from: "2026-09-29" }]);

    expect(screen.getAllByTestId("calendar-stripe-eva-1")).toHaveLength(1);
    expect(screen.getByTestId("calendar-stripe-eva-1")).toHaveStyle({ opacity: 1 });
  });

  it("draws a pending stripe on an adjacent day the way it draws one in the month", async () => {
    await renderMonth([
      stripe("eva", 5, 5, { status: "pending" }),
      stripe("tom", 1, 1, {
        status: "pending",
        from: "2026-11-01",
        to: "2026-11-01",
        vacationIds: ["tom-nov"],
      }),
    ]);

    expect(screen.getByTestId("calendar-stripe-tom-nov")).toHaveStyle({ opacity: 0.4 });
    expect(screen.getByTestId("calendar-stripe-eva-5")).toHaveStyle({ opacity: 0.4 });
  });

  it("marks the selected day", async () => {
    await renderMonth([], "2026-10-20");

    expect(screen.getByTestId("calendar-day-2026-10-20")).toBeSelected();
    expect(screen.getByTestId("calendar-day-2026-10-14")).not.toBeSelected();
  });

  it("draws no names, three stripes in a week with the viewer's own among them, and +N beyond", async () => {
    await renderMonth([
      stripe("ada", 12, 16),
      stripe("ben", 12, 16),
      stripe("cyd", 12, 16),
      stripe(VIEWER, 14, 14),
    ]);

    expect(screen.getByTestId("calendar-stripe-me-14")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-stripe-ada-12")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-stripe-ben-12")).toBeOnTheScreen();
    expect(screen.queryByTestId("calendar-stripe-cyd-12")).toBeNull();
    expect(screen.getByTestId("calendar-more-2026-10-12")).toHaveTextContent("+1");
    expect(screen.queryByText(/Novak|You/)).toBeNull();
  });

  it("draws a pending stripe faded", async () => {
    await renderMonth([stripe("eva", 5, 6, { status: "pending" }), stripe("tom", 7, 7)]);

    expect(screen.getByTestId("calendar-stripe-eva-5")).toHaveStyle({ opacity: 0.4 });
    expect(screen.getByTestId("calendar-stripe-tom-7")).toHaveStyle({ opacity: 1 });
  });

  it("tints a bank holiday's day and names it to a screen reader", async () => {
    await renderMonth([holiday(28, "Statehood")]);

    expect(screen.getByTestId("calendar-day-2026-10-28")).toHaveAccessibleName(
      "Wed 28 Oct, Statehood"
    );
    expect(screen.getByTestId("calendar-day-2026-10-27")).toHaveAccessibleName("Tue 27 Oct");
  });

  it("says how many people are away on a day, and which day is today, to a screen reader", async () => {
    await renderMonth([
      stripe("ada", 12, 16),
      { ...stripe("ada", 14, 14, { type: "HOME_OFFICE" }), id: "ada-home" },
      stripe("ben", 15, 15),
    ]);

    expect(screen.getByTestId("calendar-day-2026-10-14")).toHaveProp(
      "accessibilityLabel",
      "Today, Wed 14 Oct, 1 away or remote"
    );
    expect(screen.getByTestId("calendar-day-2026-10-15")).toHaveProp(
      "accessibilityLabel",
      "Thu 15 Oct, 2 away or remote"
    );
    expect(screen.getByTestId("calendar-day-2026-10-19")).toHaveProp(
      "accessibilityLabel",
      "Mon 19 Oct"
    );
  });
});

describe("stripeMonthHeight", () => {
  it("returns a taller grid for six weeks than for five", () => {
    expect(stripeMonthHeight(6)).toBeGreaterThan(stripeMonthHeight(5));
  });
});
