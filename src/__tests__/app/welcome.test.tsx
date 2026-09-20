import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import WelcomeScreen from "@/app/(auth)/welcome";
import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { openWebPage } from "@/lib/web";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

jest.mock("@/lib/web", () => ({
  openWebPage: jest.fn(),
  WEB_PATHS: jest.requireActual("@/lib/web").WEB_PATHS,
}));

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

const getLocales = jest.requireMock("expo-localization").getLocales as jest.Mock;
const push = router.push as jest.Mock;
const openPage = openWebPage as jest.MockedFunction<typeof openWebPage>;

beforeEach(() => {
  jest.clearAllMocks();
  getLocales.mockReturnValue([{ languageCode: "en" }]);
  openPage.mockResolvedValue(undefined);
});

function renderWelcome() {
  return render(
    <TranslationProvider>
      <WelcomeScreen />
    </TranslationProvider>
  );
}

function speakCzech() {
  getLocales.mockReturnValue([{ languageCode: "cs" }]);
}

describe("WelcomeScreen", () => {
  it("renders the tagline and both ways on", async () => {
    await renderWelcome();

    expect(screen.getByText(en.auth.welcome.tagline)).toBeTruthy();
    expect(screen.getByText(en.auth.welcome.signIn)).toBeTruthy();
    expect(screen.getByText(en.auth.welcome.createOnWeb)).toBeTruthy();
  });

  it("renders in Czech for a phone set to Czech", async () => {
    speakCzech();

    await renderWelcome();

    expect(screen.getByText(cs.auth.welcome.tagline)).toBeTruthy();
    expect(screen.getByText(cs.auth.welcome.signIn)).toBeTruthy();
    expect(screen.getByText(cs.auth.welcome.createOnWeb)).toBeTruthy();
  });

  it("opens the sign-in screen when the primary action is tapped", async () => {
    await renderWelcome();

    fireEvent.press(screen.getByText(en.auth.welcome.signIn));

    expect(push).toHaveBeenCalledWith("/sign-in");
  });

  it("opens the sign-in screen when the primary action is tapped in Czech", async () => {
    speakCzech();

    await renderWelcome();

    fireEvent.press(screen.getByText(cs.auth.welcome.signIn));

    expect(push).toHaveBeenCalledWith("/sign-in");
  });

  it("opens the web sign-up page when the account link is tapped", async () => {
    await renderWelcome();

    fireEvent.press(screen.getByText(en.auth.welcome.createOnWeb));

    expect(openPage).toHaveBeenCalledWith("/sign-up/");
  });
});
