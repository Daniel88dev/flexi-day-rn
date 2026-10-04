import { fireEvent, render, screen } from "@testing-library/react-native";

import { UsageCard } from "@/components/report/usage-card";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarRecordType } from "@/lib/local-store";
import type { WindowState } from "@/lib/query";
import {
  assignMemberColors,
  trailingMonths,
  uniqueMembers,
  withYear,
  type ReportScopeMember,
} from "@/lib/report";
import {
  CROSS_YEAR_TODAY,
  crossOverview2025,
  crossOverview2026,
  crossScope,
} from "@/test-support/report";

let mockLanguage = "en";
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: mockLanguage }] }));

const members = uniqueMembers(crossOverview2026.members);
const colors = assignMemberColors(crossScope.members);

function windowIn(state: WindowState, retry = jest.fn()) {
  return {
    slots: trailingMonths(CROSS_YEAR_TODAY),
    usage: [
      ...(state === "incomplete" ? [] : withYear(2025, crossOverview2025.monthly)),
      ...withYear(2026, crossOverview2026.monthly),
    ],
    state,
    priorYear: 2025,
    retry,
  };
}

function card(
  state: WindowState = "ready",
  type: CalendarRecordType = "VACATION",
  people: ReportScopeMember[] = members,
  retry = jest.fn()
) {
  return (
    <TranslationProvider>
      <UsageCard window={windowIn(state, retry)} members={people} colors={colors} type={type} />
    </TranslationProvider>
  );
}

beforeEach(() => {
  mockLanguage = "en";
});

describe("UsageCard", () => {
  it("renders the type, the window, the total and the chart across both years", async () => {
    await render(card());

    expect(screen.getByText("Vacation taken")).toBeOnTheScreen();
    expect(screen.getByText("Mar 2025 to Feb 2026")).toBeOnTheScreen();
    expect(screen.getByText("26.5")).toBeOnTheScreen();
    expect(screen.getByText("days")).toBeOnTheScreen();
    expect(screen.getByTestId("usage-chart-col-11")).toHaveProp(
      "accessibilityLabel",
      "February 2026, 2 days: Bob Dvorak 2"
    );
    expect(screen.queryByTestId("report-incomplete")).toBeNull();
  });

  it("renders Loading the months and no chart or total while the window is pending", async () => {
    await render(card("pending"));

    expect(screen.getByText("Loading the months")).toBeOnTheScreen();
    expect(screen.queryByTestId("usage-chart")).toBeNull();
    expect(screen.queryByText("26.5")).toBeNull();
  });

  it("renders the incomplete note with Retry above the chart", async () => {
    const retry = jest.fn();
    await render(card("incomplete", "VACATION", members, retry));

    expect(
      screen.getByText("2025 didn't load, so its months show no leave yet.")
    ).toBeOnTheScreen();
    expect(screen.getByText("6")).toBeOnTheScreen();
    expect(screen.getByTestId("usage-chart")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("report-incomplete-retry"));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("says no one matches when the answer has nobody in it", async () => {
    await render(card("ready", "VACATION", []));

    expect(screen.getByText("No one matches these filters.")).toBeOnTheScreen();
    expect(screen.queryByTestId("usage-chart")).toBeNull();
  });

  it("renders every person again after the leave type or the people change", async () => {
    await render(card());
    await fireEvent.press(screen.getByTestId("usage-legend-u-bob"));
    expect(screen.getByTestId("usage-legend-u-bob")).toHaveProp("accessibilityState", {
      checked: false,
    });

    await screen.rerender(card("ready", "SICK_DAY"));
    expect(screen.getByText("Sick day taken")).toBeOnTheScreen();
    expect(screen.getByTestId("usage-legend-u-bob")).toHaveProp("accessibilityState", {
      checked: true,
    });

    await fireEvent.press(screen.getByTestId("usage-legend-u-bob"));
    await screen.rerender(
      card(
        "ready",
        "SICK_DAY",
        members.filter((member) => member.id !== "u-erin")
      )
    );
    expect(screen.getByTestId("usage-legend-u-bob")).toHaveProp("accessibilityState", {
      checked: true,
    });
  });

  it("renders Czech month names, the comma and the plural", async () => {
    mockLanguage = "cs";

    await render(card());

    expect(screen.getByText("Dovolená: vybráno")).toBeOnTheScreen();
    expect(screen.getByText("Bře 2025 až Úno 2026")).toBeOnTheScreen();
    expect(screen.getByText("26,5")).toBeOnTheScreen();
    expect(screen.getByText("dne")).toBeOnTheScreen();
    expect(screen.getByTestId("usage-chart-col-11")).toHaveProp(
      "accessibilityLabel",
      "Únor 2026, 2 dny: Bob Dvorak 2"
    );
  });
});
