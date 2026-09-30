import { render, screen, within } from "@testing-library/react-native";

import CalendarSyncScreen from "@/app/calendar-sync";
import GroupsScreen from "@/app/groups";
import ReportScreen from "@/app/report";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

describe("placeholder screens", () => {
  it.each([
    ["groups", GroupsScreen, "Groups"],
    ["report", ReportScreen, "Report"],
    ["calendar-sync", CalendarSyncScreen, "Calendar sync"],
  ])("renders /%s with its root id and a coming-soon line", async (id, Screen, title) => {
    await render(
      <TranslationProvider>
        <Screen />
      </TranslationProvider>
    );

    expect(within(screen.getByTestId(id)).getByText(`${title} lands here.`)).toBeOnTheScreen();
  });
});
