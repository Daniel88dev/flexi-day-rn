import { fireEvent, render, screen, within } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { MemberBookings, MemberChanges, MemberQuotas } from "@/components/report/member-sections";
import { TranslationProvider } from "@/i18n/use-translation";
import { crossMember2026, erinOnDefaults, memberReport } from "@/test-support/report";

let mockLanguage = "en";
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: mockLanguage }] }));

async function renderIn(element: ReactElement) {
  await render(<TranslationProvider>{element}</TranslationProvider>);
}

beforeEach(() => {
  mockLanguage = "en";
});

describe("MemberQuotas", () => {
  it("renders a card per group with the summary's figures and no sick days where unmetered", async () => {
    await renderIn(<MemberQuotas report={erinOnDefaults} />);

    const group = within(screen.getByTestId("quota-group-g-support"));
    expect(screen.getByText("Quotas")).toBeOnTheScreen();
    expect(group.getByText("Dev Support")).toBeOnTheScreen();
    expect(group.getByLabelText("Vacation days, 25")).toBeOnTheScreen();
    expect(group.getByLabelText("Home office days, 10")).toBeOnTheScreen();
    expect(group.queryByText("Sick days")).toBeNull();
  });
});

describe("MemberBookings", () => {
  it("renders four bookings and toggles the rest", async () => {
    await renderIn(<MemberBookings report={crossMember2026} />);

    expect(screen.getByText("5 in 2026")).toBeOnTheScreen();
    expect(screen.queryByText("19-23 Jan")).toBeNull();

    await fireEvent.press(screen.getByTestId("member-bookings-more"));

    expect(screen.getByText("19-23 Jan")).toBeOnTheScreen();
    expect(screen.getByTestId("member-bookings-more")).toHaveProp(
      "accessibilityLabel",
      "Show fewer"
    );
  });

  it("renders the empty line without a count", async () => {
    await renderIn(<MemberBookings report={memberReport()} />);

    expect(screen.getByText("Nothing booked in 2026.")).toBeOnTheScreen();
    expect(screen.queryByText(/in 2026$/)).toBeNull();
    expect(screen.queryByTestId("member-bookings-more")).toBeNull();
  });

  it("renders Czech labels, the comma and the plural of Show all", async () => {
    mockLanguage = "cs";

    await renderIn(<MemberBookings report={crossMember2026} />);

    expect(screen.getByText("5 v roce 2026")).toBeOnTheScreen();
    expect(screen.getByText("0,5 d")).toBeOnTheScreen();
    expect(screen.getByText("Čeká")).toBeOnTheScreen();
    expect(screen.getByText("Zobrazit všech 5")).toBeOnTheScreen();
  });
});

describe("MemberChanges", () => {
  it("renders three changes and toggles the rest", async () => {
    await renderIn(<MemberChanges report={crossMember2026} />);

    expect(screen.getByText("Change history")).toBeOnTheScreen();
    expect(screen.queryByText("Sick days changed from 3 to 5")).toBeNull();

    await fireEvent.press(screen.getByTestId("member-changes-more"));

    expect(screen.getByText("Sick days changed from 3 to 5")).toBeOnTheScreen();
  });

  it("renders the empty line", async () => {
    await renderIn(<MemberChanges report={memberReport()} />);

    expect(screen.getByText("No changes to the allowance in 2026.")).toBeOnTheScreen();
    expect(screen.queryByTestId("member-changes-more")).toBeNull();
  });

  it("renders the Czech plural of Show all for a few", async () => {
    mockLanguage = "cs";

    await renderIn(<MemberChanges report={crossMember2026} />);

    expect(screen.getByText("Historie změn")).toBeOnTheScreen();
    expect(screen.getByText("Zobrazit všechny 4")).toBeOnTheScreen();
    expect(screen.getByText(/, provedl\(a\) smazaný účet$/)).toBeOnTheScreen();
  });
});
