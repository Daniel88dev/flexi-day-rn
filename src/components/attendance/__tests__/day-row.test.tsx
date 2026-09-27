import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { DayRow } from "@/components/attendance/day-row";
import { TranslationProvider } from "@/i18n/use-translation";
import type { AttendanceBalanceMode, AttendanceMonthDay } from "@/lib/attendance";
import { monthDay } from "@/test-support/attendance";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));

const TODAY = "2026-09-27";

async function renderRow(day: AttendanceMonthDay, mode: AttendanceBalanceMode = "DAILY") {
  const onOpen = jest.fn();
  await render(
    <TranslationProvider>
      <DayRow day={day} mode={mode} today={TODAY} onOpen={onOpen} />
    </TranslationProvider>
  );
  return onOpen;
}

describe("DayRow", () => {
  it("shows the weekday, the figures and the balance, and opens its day", async () => {
    const onOpen = await renderRow(monthDay({ businessDate: "2026-09-24" }));

    expect(screen.getByText("Thu")).toBeTruthy();
    expect(screen.getByText("Sep 24")).toBeTruthy();
    expect(screen.getByText("5:14")).toBeTruthy();
    expect(screen.getByText("of 8:00")).toBeTruthy();
    expect(screen.getByText("5:44 present")).toBeTruthy();
    expect(within(screen.getByTestId("chip-balance")).getByText("-2:46")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("day-row-2026-09-24"));
    expect(onOpen).toHaveBeenCalledWith("2026-09-24");
  });

  it("shows a flagged day's chips and no balance in MONTHLY mode", async () => {
    await renderRow(
      monthDay({
        businessDate: "2026-09-24",
        balanceMinutes: null,
        autoClosed: true,
        excludedClockIn: true,
        changedAfterDay: true,
        open: true,
        entered: true,
        flagged: true,
      }),
      "MONTHLY"
    );

    expect(screen.queryByTestId("chip-balance")).toBeNull();
    expect(screen.getByText("Auto-closed")).toBeTruthy();
    expect(screen.getByText("Excluded day")).toBeTruthy();
    expect(screen.getByText("Changed later")).toBeTruthy();
    expect(screen.getByText("Still open")).toBeTruthy();
    expect(screen.getByText("Entered")).toBeTruthy();
  });

  it("hatches a full day off and names it", async () => {
    await renderRow(
      monthDay({
        presenceMinutes: 0,
        workedMinutes: 0,
        requiredMinutes: 0,
        balanceMinutes: null,
        exclusion: { cause: "NON_WORKING_DAY", extent: "FULL", label: null },
      })
    );

    const hatch = StyleSheet.flatten(screen.getByTestId("hatch").props.style);
    expect(hatch.experimental_backgroundImage).toContain("linear-gradient(-45deg");
    expect(hatch.experimental_backgroundRepeat).toBe("repeat");
    expect(screen.getByText("Non-working day")).toBeTruthy();
    expect(screen.queryByText("0:00")).toBeNull();
  });

  it("marks a day to come as dashed To come, with nothing to open", async () => {
    const onOpen = await renderRow(monthDay({ businessDate: "2026-09-28", upcoming: true }));

    const row = screen.getByTestId("day-row-2026-09-28");
    expect(screen.getByText("To come")).toBeTruthy();
    expect(row.props.style).toEqual(expect.objectContaining({ borderStyle: "dashed" }));
    expect(row.props.accessibilityRole).toBeUndefined();
    await fireEvent.press(row);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
