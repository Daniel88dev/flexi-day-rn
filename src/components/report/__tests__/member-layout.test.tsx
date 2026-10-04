import { render, screen } from "@testing-library/react-native";

import { MemberLayout, type MemberWindow } from "@/components/report/member-layout";
import { TranslationProvider } from "@/i18n/use-translation";
import { calendarMonths, withYear } from "@/lib/report";
import { crossMember2026 } from "@/test-support/report";

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
  getCalendars: () => [{ uses24hourClock: true }],
}));

function windowIn(state: MemberWindow["state"], staleSince: Date | null = null): MemberWindow {
  return {
    slots: calendarMonths(2026),
    usage: withYear(2026, crossMember2026.monthly),
    state,
    priorYear: 2025,
    staleSince,
    retry: jest.fn(),
  };
}

async function renderLayout(
  state: MemberWindow["state"] = "ready",
  staleSince: Date | null = null
) {
  await render(
    <TranslationProvider>
      <MemberLayout
        testID="member-report"
        title="Your leave"
        subtitle="Bob Dvorak, Dev Team"
        color="#2a78d6"
        report={crossMember2026}
        window={windowIn(state, staleSince)}
        period={2026}
        years={[2025, 2026]}
        onPeriodChange={jest.fn()}
      />
    </TranslationProvider>
  );
}

describe("MemberLayout", () => {
  it("renders the heading it is given, the period chip and a card per allowance", async () => {
    await renderLayout();

    expect(screen.getByTestId("member-report")).toBeOnTheScreen();
    expect(screen.getByText("Your leave")).toBeOnTheScreen();
    expect(screen.getByText("Bob Dvorak, Dev Team")).toBeOnTheScreen();
    expect(screen.getByTestId("member-period")).toHaveProp("accessibilityLabel", "Period, 2026");
    expect(screen.getByTestId("allowance-VACATION")).toBeOnTheScreen();
    expect(screen.getByTestId("allowance-SICK_DAY-expand")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-incomplete")).toBeNull();
    expect(screen.queryByTestId("report-stale")).toBeNull();
  });

  it("renders the offline notice after the period chip and before the incomplete note", async () => {
    await renderLayout("incomplete", new Date());

    const order = screen
      .getAllByTestId(/^(member-period|report-stale|report-incomplete|allowance-VACATION)$/)
      .map((node) => node.props.testID as string);
    expect(order).toEqual([
      "member-period",
      "report-stale",
      "report-incomplete",
      "allowance-VACATION",
    ]);
    expect(screen.getByTestId("report-stale")).toHaveTextContent(/^Offline. Showing the report/);
  });

  it("renders the incomplete note above the cards", async () => {
    await renderLayout("incomplete");

    expect(screen.getByTestId("report-incomplete")).toHaveTextContent(/2025 didn't load/);
  });
});
