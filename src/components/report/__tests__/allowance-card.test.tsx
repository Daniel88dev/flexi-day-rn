import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { AllowanceCard, type AllowanceWindow } from "@/components/report/allowance-card";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarRecordType } from "@/lib/local-store";
import { calendarMonths, withYear } from "@/lib/report";
import { crossMember2026 } from "@/test-support/report";

let mockLanguage = "en";
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: mockLanguage }] }));

const ready: AllowanceWindow = {
  slots: calendarMonths(2026),
  usage: withYear(2026, crossMember2026.monthly),
  state: "ready",
};

async function renderCard(
  type: CalendarRecordType,
  initiallyOpen: boolean,
  window: AllowanceWindow = ready
) {
  await render(
    <TranslationProvider>
      <AllowanceCard
        type={type}
        report={crossMember2026}
        window={window}
        initiallyOpen={initiallyOpen}
      />
    </TranslationProvider>
  );
}

beforeEach(() => {
  mockLanguage = "en";
});

describe("AllowanceCard", () => {
  it("renders the days left, its parts and the months when charted", async () => {
    await renderCard("SICK_DAY", true, {
      ...ready,
      usage: [...ready.usage, { ...ready.usage[0], vacationType: "SICK_DAY", used: 1 }],
    });

    expect(screen.getByText("Sick day")).toBeOnTheScreen();
    expect(screen.getByLabelText("5 days left of 5")).toBeOnTheScreen();
    expect(screen.getByLabelText("Carried in, 0")).toBeOnTheScreen();
    expect(screen.getAllByText("2026")).toHaveLength(2);
    expect(screen.getAllByTestId(/^quota-chart-SICK_DAY-col-\d+$/)).toHaveLength(12);
    expect(screen.queryByTestId("allowance-SICK_DAY-expand")).toBeNull();
  });

  it("renders an overdraft in red as days over", async () => {
    await renderCard("VACATION", true);

    expect(screen.getByLabelText("1.5 days over of 22")).toBeOnTheScreen();
    const figure = within(screen.getByTestId("allowance-VACATION-left")).getByText("1.5");
    expect(figure.props.className).toContain("text-danger");
  });

  it("renders Show months instead of the months until it is tapped", async () => {
    await renderCard("VACATION", false);

    expect(screen.queryByTestId(/^quota-chart-VACATION/)).toBeNull();
    await fireEvent.press(screen.getByTestId("allowance-VACATION-expand"));
    expect(screen.getAllByTestId(/^quota-chart-VACATION-col-\d+$/)).toHaveLength(12);
  });

  it("renders the none-in-window line for an allowance with nothing in the window", async () => {
    await renderCard("SICK_DAY", true);

    expect(screen.getByText("None taken or booked in these months.")).toBeOnTheScreen();
    expect(screen.queryByTestId(/^quota-chart-SICK_DAY/)).toBeNull();
  });

  it("renders Loading the months instead of the months while the window is pending", async () => {
    await renderCard("VACATION", true, { ...ready, state: "pending" });

    expect(screen.getByText("Loading the months")).toBeOnTheScreen();
    expect(screen.queryByTestId(/^quota-chart-VACATION/)).toBeNull();
  });

  it("renders Czech labels, plurals and the comma", async () => {
    mockLanguage = "cs";

    await renderCard("VACATION", false);

    expect(screen.getByText("Dovolená")).toBeOnTheScreen();
    expect(screen.getByLabelText("1,5 dne přečerpáno z 22")).toBeOnTheScreen();
    expect(screen.getByLabelText("Vybráno, 1,5")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ke schválení, 0,5")).toBeOnTheScreen();
    expect(screen.getByText("Zobrazit měsíce")).toBeOnTheScreen();
  });
});
