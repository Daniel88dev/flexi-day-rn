import { fireEvent, render, screen } from "@testing-library/react-native";

import { StripeMonth, stripeMonthHeight } from "@/components/calendar/stripe-month";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarRange } from "@/lib/calendar/lanes";

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
    from,
    to,
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

async function renderMonth(ranges: CalendarRange[], selected = "2026-10-14") {
  const onDay = jest.fn();
  await render(
    <TranslationProvider>
      <StripeMonth
        month={OCTOBER}
        ranges={ranges}
        width={390}
        viewerId={VIEWER}
        today="2026-10-14"
        selected={selected}
        onDay={onDay}
      />
    </TranslationProvider>
  );
  return onDay;
}

describe("StripeMonth", () => {
  it("renders a cell for every day of the month and selects a tapped one", async () => {
    const onDay = await renderMonth([]);

    expect(screen.getByTestId("calendar-month-2026-10")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-day-2026-10-01")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-day-2026-10-31")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("calendar-day-2026-10-20"));

    expect(onDay).toHaveBeenCalledWith("2026-10-20");
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
