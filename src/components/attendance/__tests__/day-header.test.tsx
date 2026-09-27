import { fireEvent, render, screen } from "@testing-library/react-native";

import { DayStepper, RangeStepper, ViewPill } from "@/components/attendance/day-header";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));

const TODAY = "2026-09-27";

async function renderStepper(date: string) {
  const onChange = jest.fn();
  await render(
    <TranslationProvider>
      <DayStepper date={date} today={TODAY} onChange={onChange} />
    </TranslationProvider>
  );
  return onChange;
}

const disabled = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState?.disabled === true;

describe("DayStepper", () => {
  it("offers no step forward and no Today chip on today", async () => {
    await renderStepper(TODAY);

    expect(screen.getByText("Sunday, September 27")).toBeTruthy();
    expect(disabled("attendance-day-next")).toBe(true);
    expect(disabled("attendance-day-previous")).toBe(false);
    expect(screen.queryByTestId("attendance-today")).toBeNull();
  });

  it("steps back a day", async () => {
    const onChange = await renderStepper(TODAY);

    await fireEvent.press(screen.getByTestId("attendance-day-previous"));

    expect(onChange).toHaveBeenCalledWith("2026-09-26");
  });

  it("steps forward onto today as today itself, and offers the Today chip off it", async () => {
    const onChange = await renderStepper("2026-09-26");

    await fireEvent.press(screen.getByTestId("attendance-day-next"));
    expect(onChange).toHaveBeenLastCalledWith(null);

    await fireEvent.press(screen.getByTestId("attendance-today"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe("ViewPill", () => {
  it("marks the view shown and picks any of the three", async () => {
    const onChange = jest.fn();
    await render(
      <TranslationProvider>
        <ViewPill value="day" onChange={onChange} />
      </TranslationProvider>
    );

    expect(screen.getByTestId("attendance-view-day").props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId("attendance-view-week"));
    expect(onChange).toHaveBeenLastCalledWith("week");
    await fireEvent.press(screen.getByTestId("attendance-view-month"));
    expect(onChange).toHaveBeenLastCalledWith("month");
  });
});

describe("RangeStepper", () => {
  async function renderRange(view: "week" | "month", anchor: string) {
    const onChange = jest.fn();
    await render(
      <TranslationProvider>
        <RangeStepper view={view} anchor={anchor} today={TODAY} onChange={onChange} />
      </TranslationProvider>
    );
    return onChange;
  }

  it("titles the week holding today, with no step forward and no Today chip", async () => {
    const onChange = await renderRange("week", TODAY);

    expect(screen.getByTestId("attendance-range").props.children).toBe("Sep 21 - Sep 27");
    expect(disabled("attendance-range-next")).toBe(true);
    expect(screen.queryByTestId("attendance-today")).toBeNull();

    await fireEvent.press(screen.getByTestId("attendance-range-previous"));
    expect(onChange).toHaveBeenCalledWith("2026-09-14");
  });

  it("steps a past month forward onto today's, as today itself", async () => {
    const onChange = await renderRange("month", "2026-08-01");

    expect(screen.getByText("August 2026")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("attendance-range-next"));
    expect(onChange).toHaveBeenLastCalledWith(null);

    await fireEvent.press(screen.getByTestId("attendance-today"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
