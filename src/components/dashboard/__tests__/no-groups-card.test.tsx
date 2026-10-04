import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { NoGroupsCard } from "@/components/dashboard/no-groups-card";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { openWebPage } from "@/lib/web";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/lib/web", () => ({
  openWebPage: jest.fn().mockResolvedValue(undefined),
  WEB_PATHS: { groups: "/groups/" },
}));

async function renderCard() {
  await render(
    <TranslationProvider>
      <NoGroupsCard />
    </TranslationProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe("NoGroupsCard", () => {
  it("says joining happens with the invite and creating on the web", async () => {
    await renderCard();

    expect(screen.getByText(en.dashboard.noGroups.title)).toBeTruthy();
    expect(screen.getByText(en.dashboard.noGroups.body)).toBeTruthy();
  });

  it("opens the Join sheet from Join a group", async () => {
    await renderCard();

    await fireEvent.press(screen.getByTestId("no-groups-join"));

    expect(screen.getByTestId("no-groups-join")).toHaveTextContent(en.dashboard.noGroups.join);
    expect(router.push).toHaveBeenCalledWith("/groups/join");
    expect(openWebPage).not.toHaveBeenCalled();
  });

  it("keeps the web's groups page behind Create a group on the web", async () => {
    await renderCard();

    await fireEvent.press(screen.getByTestId("no-groups-open-web"));

    expect(screen.getByTestId("no-groups-open-web")).toHaveTextContent(
      en.dashboard.noGroups.createOnWeb
    );
    expect(openWebPage).toHaveBeenCalledWith("/groups/");
    expect(router.push).not.toHaveBeenCalled();
  });
});
