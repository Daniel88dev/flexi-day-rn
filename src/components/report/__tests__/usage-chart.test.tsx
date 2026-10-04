import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { UsageChart } from "@/components/report/usage-chart";
import { TranslationProvider } from "@/i18n/use-translation";
import {
  assignMemberColors,
  buildTeamMonthlySeries,
  trailingMonths,
  uniqueMembers,
  withYear,
} from "@/lib/report";
import {
  CROSS_YEAR_TODAY,
  crossOverview2025,
  crossOverview2026,
  crossScope,
} from "@/test-support/report";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const slots = trailingMonths(CROSS_YEAR_TODAY);
const usage = [
  ...withYear(2025, crossOverview2025.monthly),
  ...withYear(2026, crossOverview2026.monthly),
];
const members = uniqueMembers(crossOverview2026.members);
const colors = assignMemberColors(crossScope.members);
const HIDDEN = { includeHiddenElements: true };

async function renderChart(people = members, width = 324) {
  const series = buildTeamMonthlySeries(
    usage,
    people.map((member) => member.id),
    "VACATION",
    slots
  );
  await render(
    <TranslationProvider>
      <UsageChart series={series} members={people} colors={colors} />
    </TranslationProvider>
  );
  await fireEvent(screen.getByTestId("usage-chart"), "layout", {
    nativeEvent: { layout: { width, height: 168, x: 0, y: 0 } },
  });
}

const tip = () => screen.queryByTestId("usage-chart-tip", HIDDEN);

describe("UsageChart", () => {
  it("renders one column per month labelled with the month, its total and each person's days", async () => {
    await renderChart();

    expect(screen.getAllByTestId(/^usage-chart-col-\d+$/)).toHaveLength(12);
    const june = screen.getByTestId("usage-chart-col-3");
    expect(june).toHaveProp("accessibilityLabel", "June 2025, 8 days: Erin Kral 3, Bob Dvorak 5");
    expect(june).toHaveProp("accessibilityRole", "button");
    expect(june).toHaveProp("accessibilityState", { selected: false });
    expect(screen.getByTestId("usage-chart-col-1")).toHaveProp(
      "accessibilityLabel",
      "April 2025, 0 days. Nobody took leave"
    );
  });

  it("opens the callout on a tap with the month, the total and each person's days, and closes it on a second tap", async () => {
    await renderChart();
    expect(tip()).toBeNull();

    await fireEvent.press(screen.getByTestId("usage-chart-col-9"));

    expect(screen.getByTestId("usage-chart-col-9")).toHaveProp("accessibilityState", {
      selected: true,
    });
    const callout = within(screen.getByTestId("usage-chart-tip", HIDDEN));
    expect(callout.getByText("December 2025", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("4.5 d", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Frank Benes", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("1.5", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Bob Dvorak", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("3", HIDDEN)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("usage-chart-col-9"));

    expect(tip()).toBeNull();
  });

  it("hides the callout from VoiceOver, since the column label already carries it", async () => {
    await renderChart();
    await fireEvent.press(screen.getByTestId("usage-chart-col-3"));

    expect(screen.queryByTestId("usage-chart-tip")).toBeNull();
    expect(tip()).toHaveProp("accessibilityElementsHidden", true);
  });

  it("places the callout right of a column in the first half and left of one in the second", async () => {
    await renderChart();

    await fireEvent.press(screen.getByTestId("usage-chart-col-1"));
    const right = tip()?.props.style.left;
    await fireEvent.press(screen.getByTestId("usage-chart-col-10"));
    const left = tip()?.props.style.left;

    // 300 px of plot after the 24 px axis, so each month's slot is 25 px wide.
    expect(right).toBe(24 + 2 * 25 + 4);
    expect(left).toBe(24 + 10 * 25 - 184 - 4);
  });

  it("places the callout clear of the selected column on a phone-width card", async () => {
    await renderChart(members, 329);
    const slot = 305 / 12;

    for (let index = 0; index < 12; index++) {
      await fireEvent.press(screen.getByTestId(`usage-chart-col-${index}`));
      const { left, width } = tip()?.props.style;
      const columnLeft = 24 + index * slot;
      const clear = left + width <= columnLeft + 1e-6 || left >= columnLeft + slot - 1e-6;
      expect({ index, clear }).toEqual({ index, clear: true });
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(329 + 1e-6);
      await fireEvent.press(screen.getByTestId(`usage-chart-col-${index}`));
    }
  });

  it("says nobody took leave in a month without any", async () => {
    await renderChart();

    await fireEvent.press(screen.getByTestId("usage-chart-col-1"));

    expect(
      within(screen.getByTestId("usage-chart-tip", HIDDEN)).getByText("Nobody took leave", HIDDEN)
    ).toBeOnTheScreen();
  });

  it("renders a legend chip per person with the first name, as a switch that hides them", async () => {
    await renderChart();

    const bob = screen.getByTestId("usage-legend-u-bob");
    expect(within(bob).getByText("Bob")).toBeOnTheScreen();
    expect(bob).toHaveProp("accessibilityRole", "switch");
    expect(bob).toHaveProp("accessibilityLabel", "Bob Dvorak");
    expect(bob).toHaveProp("accessibilityState", { checked: true });

    await fireEvent.press(bob);

    expect(screen.getByTestId("usage-legend-u-bob")).toHaveProp("accessibilityState", {
      checked: false,
    });
    expect(screen.getByTestId("usage-chart-col-3")).toHaveProp(
      "accessibilityLabel",
      "June 2025, 3 days: Erin Kral 3"
    );

    await fireEvent.press(screen.getByTestId("usage-legend-u-bob"));

    expect(screen.getByTestId("usage-chart-col-3")).toHaveProp(
      "accessibilityLabel",
      "June 2025, 8 days: Erin Kral 3, Bob Dvorak 5"
    );
  });

  it("renders no legend for one person", async () => {
    await renderChart(members.filter((member) => member.id === "u-bob"));

    expect(screen.queryByTestId("usage-legend-u-bob")).toBeNull();
    expect(screen.getByTestId("usage-chart-col-3")).toHaveProp(
      "accessibilityLabel",
      "June 2025, 5 days: Bob Dvorak 5"
    );
  });
});
