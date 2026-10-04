import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import SignInScreen from "@/app/(auth)/sign-in";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { clearHeldInvite, heldInvite, holdInvite } from "@/lib/session/held-invite";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { openWebPage } from "@/lib/web";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock("@/lib/web", () => ({
  openWebPage: jest.fn(),
  WEB_PATHS: jest.requireActual("@/lib/web").WEB_PATHS,
}));

jest.mock("@/lib/session/auth-client", () => ({
  authClient: { signIn: { email: jest.fn() } },
}));

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

const openPage = openWebPage as jest.MockedFunction<typeof openWebPage>;
const back = router.back as jest.Mock;

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  clearHeldInvite();
  openPage.mockResolvedValue(undefined);
});

function renderSignIn() {
  return render(
    <RootRouteProvider route="welcome">
      <TranslationProvider>
        <SignInScreen />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

describe("SignInScreen", () => {
  it("opens the web password reset from the password label row", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByText(en.auth.signIn.forgot));

    expect(openPage).toHaveBeenCalledWith("/forgot-password/");
  });

  it("opens the web password reset from the Google and Microsoft hint", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByText(en.auth.signIn.socialHintLink));

    expect(openPage).toHaveBeenCalledWith("/forgot-password/");
  });

  it("opens the web sign-up from the footer", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByText(en.auth.signIn.createTeam));

    expect(openPage).toHaveBeenCalledWith("/sign-up/");
  });

  it("starts with an empty address when no invite is held", async () => {
    await renderSignIn();

    expect(screen.getByTestId("sign-in-email")).toHaveDisplayValue("");
  });

  it("starts with the held invite's address filled in, and keeps holding the invite", async () => {
    const invite = {
      token: "dev-alice-support-00000000000000000",
      invitedEmail: "alice@dev.local",
    };
    holdInvite(invite);

    await renderSignIn();

    expect(screen.getByTestId("sign-in-email")).toHaveDisplayValue("alice@dev.local");
    expect(screen.getByTestId("sign-in-password")).toHaveDisplayValue("");
    expect(heldInvite()).toEqual(invite);
  });

  it("starts with an empty address for a held invite sent to no address", async () => {
    holdInvite({ token: "dev-anyone-00000000000000000000000000", invitedEmail: null });

    await renderSignIn();

    expect(screen.getByTestId("sign-in-email")).toHaveDisplayValue("");
  });

  it("goes back to welcome from the back button", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByLabelText(en.auth.signIn.back));

    expect(back).toHaveBeenCalled();
  });
});
