import { fireEvent, render, screen } from "@testing-library/react-native";

import { NoGroupsCard } from "@/components/dashboard/no-groups-card";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { openWebPage } from "@/lib/web";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/web", () => ({
  openWebPage: jest.fn().mockResolvedValue(undefined),
  WEB_PATHS: { groups: "/groups/" },
}));

describe("NoGroupsCard", () => {
  it("points to the web's groups page to join or create a group", async () => {
    await render(
      <TranslationProvider>
        <NoGroupsCard />
      </TranslationProvider>
    );

    expect(screen.getByText(en.dashboard.noGroups.title)).toBeTruthy();
    await fireEvent.press(screen.getByText(en.dashboard.noGroups.open));

    expect(openWebPage).toHaveBeenCalledWith("/groups/");
  });
});
