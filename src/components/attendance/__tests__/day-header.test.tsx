import { fireEvent, render, screen } from "@testing-library/react-native";

import { DayStepper, ViewPill } from "@/components/attendance/day-header";
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
  it("picks a built view and leaves the others inert", async () => {
    const onChange = jest.fn();
    await render(
      <TranslationProvider>
        <ViewPill value="day" available={["day"]} onChange={onChange} />
      </TranslationProvider>
    );

    expect(screen.getByTestId("attendance-view-day").props.accessibilityState.selected).toBe(true);
    expect(disabled("attendance-view-week")).toBe(true);
    expect(disabled("attendance-view-month")).toBe(true);
    await fireEvent.press(screen.getByTestId("attendance-view-day"));
    expect(onChange).toHaveBeenCalledWith("day");
  });
});
