import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { useState } from "react";

import { PeriodChip, PeriodControls, ReportFilterBar } from "@/components/report/report-filters";
import { TranslationProvider } from "@/i18n/use-translation";
import {
  assignMemberColors,
  DEFAULT_OVERVIEW_FILTERS,
  type OverviewFilters,
  type ReportScope,
} from "@/lib/report";
import { crossScope } from "@/test-support/report";

let mockLanguage = "en";
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: mockLanguage }] }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

function Bar({ scope = crossScope, start = DEFAULT_OVERVIEW_FILTERS }) {
  const [filters, setFilters] = useState<OverviewFilters>(start);
  return (
    <ReportFilterBar
      scope={scope as ReportScope}
      colors={assignMemberColors(scope.members)}
      filters={filters}
      onChange={setFilters}
    />
  );
}

const renderIn = (node: React.ReactElement) =>
  render(<TranslationProvider>{node}</TranslationProvider>);

beforeEach(() => {
  mockLanguage = "en";
  jest.useFakeTimers({ now: new Date(2026, 1, 16, 10), doNotFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => jest.useRealTimers());

describe("PeriodChip", () => {
  it("renders its sheet under an id taken from the chip's, and closes it on a pick", async () => {
    const onChange = jest.fn();
    await renderIn(
      <PeriodChip testID="member-period" period="rolling" years={[2025]} onChange={onChange} />
    );

    await fireEvent.press(screen.getByTestId("member-period"));
    await fireEvent.press(screen.getByTestId("member-period-sheet-2025"));

    expect(onChange).toHaveBeenCalledWith(2025);
    expect(screen.queryByTestId("member-period-sheet")).toBeNull();
  });
});

describe("PeriodControls", () => {
  it("renders the member period chip on the period it is given", async () => {
    await renderIn(<PeriodControls period={2025} years={[2025, 2026]} onChange={jest.fn()} />);

    expect(screen.getByTestId("member-period")).toHaveProp("accessibilityLabel", "Period, 2025");
  });
});

describe("ReportFilterBar", () => {
  it("renders the three chips on their defaults", async () => {
    await renderIn(<Bar />);

    expect(within(screen.getByTestId("report-period")).getByText("Last 12 months")).toBeTruthy();
    expect(within(screen.getByTestId("report-groups")).getByText("All groups")).toBeTruthy();
    expect(within(screen.getByTestId("report-members")).getByText("Everyone")).toBeTruthy();
  });

  it("renders the chips, the sheets, the hints and All in Czech", async () => {
    mockLanguage = "cs";
    await renderIn(
      <Bar start={{ period: 2026, groupIds: ["g-support", "g-team"], userIds: [] }} />
    );

    expect(screen.getByTestId("report-period")).toHaveProp("accessibilityLabel", "Období, 2026");
    expect(screen.getByTestId("report-groups")).toHaveProp(
      "accessibilityLabel",
      "Skupiny, 2 skupiny"
    );
    expect(screen.getByTestId("report-members")).toHaveProp("accessibilityLabel", "Lidé, Všichni");

    await fireEvent.press(screen.getByTestId("report-period"));
    const period = screen.getByTestId("period-sheet");
    expect(within(period).getByText("Posledních 12 měsíců")).toBeTruthy();
    expect(within(period).getByText("Bře 2025 až Úno 2026")).toBeTruthy();
    expect(within(period).getByText("Leden až prosinec, letos")).toBeTruthy();
    expect(within(period).getByText("Leden až prosinec")).toBeTruthy();
    expect(within(period).getByText("Hotovo")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("period-sheet-done"));

    await fireEvent.press(screen.getByTestId("report-groups"));
    const groups = screen.getByTestId("groups-sheet");
    expect(within(groups).getByText("Všechny skupiny")).toBeTruthy();
    expect(within(groups).getAllByText("2 lidé")).toHaveLength(2);
    expect(within(groups).getByText("1 člověk")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("groups-sheet-done"));

    await fireEvent.press(screen.getByTestId("report-members"));
    expect(within(screen.getByTestId("members-sheet")).getByText("Všichni")).toBeTruthy();
  });
});
