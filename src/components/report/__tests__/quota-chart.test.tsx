import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { QuotaChart } from "@/components/report/quota-chart";
import { TranslationProvider } from "@/i18n/use-translation";
import { calendarMonths, monthlySeriesFor, withYear } from "@/lib/report";
import { crossMember2025 } from "@/test-support/report";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const HIDDEN = { includeHiddenElements: true };
const slots = calendarMonths(2025);
const series = monthlySeriesFor(
  withYear(2025, crossMember2025.monthly),
  "u-bob",
  slots,
  "VACATION"
);

async function renderChart(quota: number) {
  await render(
    <TranslationProvider>
      <QuotaChart type="VACATION" slots={slots} series={series} quota={quota} />
    </TranslationProvider>
  );
  await fireEvent(screen.getByTestId("quota-chart-VACATION"), "layout", {
    nativeEvent: { layout: { width: 320, height: 150, x: 0, y: 0 } },
  });
}

describe("QuotaChart", () => {
  it("renders a column per month labelled with its used and pending days, and the even pace", async () => {
    await renderChart(24);

    expect(screen.getAllByTestId(/^quota-chart-VACATION-col-\d+$/)).toHaveLength(12);
    expect(screen.getByTestId("quota-chart-VACATION-col-11")).toHaveProp(
      "accessibilityLabel",
      "December 2025: 2 used, 1 pending"
    );
    expect(screen.getByTestId("quota-chart-VACATION-guide")).toBeOnTheScreen();
  });

  it("renders Approved, Pending and Even pace in the callout of a tapped month", async () => {
    await renderChart(24);

    await fireEvent.press(screen.getByTestId("quota-chart-VACATION-col-11"));

    const callout = within(screen.getByTestId("quota-chart-VACATION-tip", HIDDEN));
    expect(callout.getByText("December 2025", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Approved", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Pending", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Even pace", HIDDEN)).toBeOnTheScreen();
    expect(callout.getAllByText("2", HIDDEN)).toHaveLength(2);
  });

  it("renders no even pace without an allowance", async () => {
    await renderChart(0);

    expect(screen.queryByTestId("quota-chart-VACATION-guide")).toBeNull();
    await fireEvent.press(screen.getByTestId("quota-chart-VACATION-col-5"));
    expect(screen.queryByText("Even pace", HIDDEN)).toBeNull();
    expect(screen.queryByText("Pending", HIDDEN)).toBeNull();
  });
});
