import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { SignIn } from "@/components/auth/sign-in";
import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { PROVIDER_ADAPTERS } from "@/lib/auth/providers";
import type { ProviderOutcome } from "@/lib/auth/providers/types";
import { authClient } from "@/lib/session/auth-client";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { openWebPage } from "@/lib/web";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock("@/lib/session/auth-client", () => ({
  authClient: { signIn: { email: jest.fn(), social: jest.fn() } },
}));

jest.mock("@/lib/auth/providers", () => ({
  ...jest.requireActual("@/lib/auth/providers"),
  PROVIDER_ADAPTERS: {
    apple: { provider: "apple", signIn: jest.fn() },
    google: { provider: "google", signIn: jest.fn() },
    microsoft: { provider: "microsoft", signIn: jest.fn() },
  },
}));

jest.mock("@/lib/web", () => ({
  openWebPage: jest.fn(),
  WEB_PATHS: jest.requireActual("@/lib/web").WEB_PATHS,
}));

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

const getLocales = jest.requireMock("expo-localization").getLocales as jest.Mock;
const signIn = authClient.signIn.email as unknown as jest.Mock;
const signInSocial = authClient.signIn.social as unknown as jest.Mock;
const replace = router.replace as jest.Mock;
const openPage = openWebPage as jest.MockedFunction<typeof openWebPage>;
const adapterOf = (provider: keyof typeof PROVIDER_ADAPTERS) =>
  PROVIDER_ADAPTERS[provider].signIn as jest.Mock;

const TOKEN: ProviderOutcome = { kind: "token", idToken: "an-id-token", nonce: "a-nonce" };

const onBack = jest.fn();
const onForgotPassword = jest.fn();
const onCreateAccount = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getLocales.mockReturnValue([{ languageCode: "en" }]);
  signIn.mockResolvedValue({ data: { token: "a-token" } });
  signInSocial.mockResolvedValue({ data: { token: "a-token" } });
  openPage.mockResolvedValue(undefined);
  for (const provider of ["apple", "google", "microsoft"] as const) {
    adapterOf(provider).mockResolvedValue(TOKEN);
  }
});

function renderSignIn() {
  return render(
    <RootRouteProvider route="welcome">
      <TranslationProvider>
        <SignIn
          onBack={onBack}
          onForgotPassword={onForgotPassword}
          onCreateAccount={onCreateAccount}
        />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

function speakCzech() {
  getLocales.mockReturnValue([{ languageCode: "cs" }]);
}

async function unfold() {
  await fireEvent.press(screen.getByTestId("sign-in-email-instead"));
}

async function fillIn(dictionary: typeof en) {
  await fireEvent.changeText(
    screen.getByPlaceholderText(dictionary.auth.emailPlaceholder),
    "owner@dev.local"
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText(dictionary.auth.signIn.passwordPlaceholder),
    "a-password"
  );
}

describe("SignIn", () => {
  it("renders under the sign-in root and goes back from auth-back", async () => {
    await renderSignIn();

    expect(screen.getByTestId("sign-in")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("auth-back"));

    expect(onBack).toHaveBeenCalled();
  });

  it("renders the three providers in Apple, Google, Microsoft order", async () => {
    await renderSignIn();

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.props.accessibilityLabel)
      .filter((label: string | undefined) => label?.startsWith("Sign in with "));

    expect(labels).toEqual([
      en.auth.signIn.signInWith.apple,
      en.auth.signIn.signInWith.google,
      en.auth.signIn.signInWith.microsoft,
    ]);
    expect(screen.getByTestId("sign-in-apple")).toBeOnTheScreen();
    expect(screen.getByTestId("sign-in-google")).toBeOnTheScreen();
    expect(screen.getByTestId("sign-in-microsoft")).toBeOnTheScreen();
  });

  it("starts folded, with no email field and no password link", async () => {
    await renderSignIn();

    expect(screen.getByText(en.auth.signIn.title)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.description)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.emailInstead)).toBeTruthy();
    expect(screen.queryByTestId("sign-in-email")).toBeNull();
    expect(screen.queryByTestId("sign-in-password")).toBeNull();
    expect(screen.queryByTestId("sign-in-submit")).toBeNull();
    expect(screen.queryByText(en.auth.signIn.forgot)).toBeNull();
    expect(screen.queryByText(en.auth.signIn.orWithEmail)).toBeNull();
    expect(screen.getByText(en.auth.signIn.createTeam)).toBeTruthy();
  });

  it("unfolds the email form behind its divider and drops the link", async () => {
    await renderSignIn();

    await unfold();

    expect(screen.getByText(en.auth.signIn.orWithEmail)).toBeTruthy();
    expect(screen.getByText(en.auth.workEmail)).toBeTruthy();
    expect(screen.getByText(en.auth.password)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.forgot)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.submit)).toBeTruthy();
    expect(screen.queryByTestId("sign-in-email-instead")).toBeNull();
    expect(screen.getByTestId("sign-in-apple")).toBeOnTheScreen();
  });

  it("carries no hint about setting a password on the web, folded or unfolded", async () => {
    await renderSignIn();
    expect(screen.queryByText(/set a password on the web/i)).toBeNull();

    await unfold();

    expect(screen.queryByText(/set a password on the web/i)).toBeNull();
    expect(screen.queryByText(/Google or Microsoft/i)).toBeNull();
  });

  it("renders the screen in Czech for a phone set to Czech", async () => {
    speakCzech();

    await renderSignIn();

    expect(screen.getByText(cs.auth.signIn.title)).toBeTruthy();
    expect(screen.getByText(cs.auth.signIn.description)).toBeTruthy();
    expect(screen.getByText(cs.auth.signIn.signInWith.apple)).toBeTruthy();
    expect(screen.getByText(cs.auth.signIn.signInWith.google)).toBeTruthy();
    expect(screen.getByText(cs.auth.signIn.signInWith.microsoft)).toBeTruthy();
    await unfold();
    expect(screen.getByText(cs.auth.signIn.orWithEmail)).toBeTruthy();
    expect(screen.getByText(cs.auth.workEmail)).toBeTruthy();
    expect(screen.getByText(cs.auth.signIn.submit)).toBeTruthy();
  });

  it("asks the web sign-up from the footer", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByText(en.auth.signIn.createTeam));

    expect(onCreateAccount).toHaveBeenCalled();
  });

  it("goes back from the back button", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByLabelText(en.auth.signIn.back));

    expect(onBack).toHaveBeenCalled();
  });
});

describe("SignIn, with a provider", () => {
  it("sends the provider's token to signIn.social and lands on the dashboard", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByTestId("sign-in-google"));

    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      idToken: { token: "an-id-token", nonce: "a-nonce", user: undefined },
    });
    expect(Object.keys(signInSocial.mock.calls[0][0]).sort()).toEqual(["idToken", "provider"]);
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("disables the other providers while one is in flight", async () => {
    signInSocial.mockReturnValue(new Promise(() => {}));
    await renderSignIn();

    await fireEvent.press(screen.getByTestId("sign-in-apple"));

    expect(screen.getByTestId("sign-in-google")).toBeDisabled();
    expect(screen.getByTestId("sign-in-microsoft")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("sign-in-microsoft"));
    expect(adapterOf("microsoft")).not.toHaveBeenCalled();
    expect(signInSocial).toHaveBeenCalledTimes(1);
  });

  it("names the tapped provider when the address already has a password account", async () => {
    signInSocial.mockResolvedValue({
      error: { status: 401, code: "OAUTH_LINK_ERROR", message: "account not linked" },
    });
    await renderSignIn();

    await fireEvent.press(screen.getByTestId("sign-in-microsoft"));

    expect(await screen.findByText(en.auth.signIn.accountNotLinked("Microsoft"))).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("sign-in-apple")).toBeEnabled();
  });

  it("opens Settings on the web from the not-linked notice", async () => {
    signInSocial.mockResolvedValue({ error: { status: 401, code: "OAUTH_LINK_ERROR" } });
    await renderSignIn();

    await fireEvent.press(screen.getByTestId("sign-in-google"));
    await fireEvent.press(await screen.findByTestId("sign-in-notice-action"));

    expect(screen.getByText(en.auth.signIn.openSettings)).toBeTruthy();
    expect(openPage).toHaveBeenCalledWith("/settings/");
  });

  it("shows the cancelled copy when the sheet is cancelled", async () => {
    adapterOf("apple").mockResolvedValue({ kind: "cancelled" });
    await renderSignIn();

    await fireEvent.press(screen.getByTestId("sign-in-apple"));

    expect(await screen.findByText(en.auth.signIn.cancelled)).toBeTruthy();
    expect(signInSocial).not.toHaveBeenCalled();
  });

  it("shows the unreachable copy when the request never reached the server", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    signInSocial.mockRejectedValue(new Error("Network request failed"));
    await renderSignIn();

    await fireEvent.press(screen.getByTestId("sign-in-google"));

    expect(await screen.findByText(en.sync.unreachable)).toBeTruthy();
  });

  it("shows the generic copy for any other refusal", async () => {
    signInSocial.mockResolvedValue({ error: { status: 500, message: "boom" } });
    await renderSignIn();

    await fireEvent.press(screen.getByTestId("sign-in-google"));

    expect(await screen.findByText(en.auth.signIn.generic)).toBeTruthy();
    expect(screen.queryByText("boom")).toBeNull();
  });

  it("shows only the latest error in the one slot the form shares", async () => {
    signIn.mockResolvedValue({ error: { message: "Invalid email or password" } });
    adapterOf("apple").mockResolvedValue({ kind: "cancelled" });
    await renderSignIn();
    await unfold();
    await fillIn(en);

    await fireEvent.press(screen.getByTestId("sign-in-submit"));
    expect(await screen.findByText("Invalid email or password")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("sign-in-apple"));
    expect(await screen.findByText(en.auth.signIn.cancelled)).toBeTruthy();
    expect(screen.queryByText("Invalid email or password")).toBeNull();

    await fireEvent.press(screen.getByTestId("sign-in-submit"));
    expect(await screen.findByText("Invalid email or password")).toBeTruthy();
    expect(screen.queryByText(en.auth.signIn.cancelled)).toBeNull();
  });
});

describe("SignIn, with email", () => {
  it("signs in with what was typed and lands on the dashboard", async () => {
    await renderSignIn();
    await unfold();

    await fillIn(en);
    await fireEvent.press(screen.getByText(en.auth.signIn.submit));

    expect(signIn).toHaveBeenCalledWith({ email: "owner@dev.local", password: "a-password" });
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("signs in in Czech too", async () => {
    speakCzech();

    await renderSignIn();
    await unfold();

    await fillIn(cs);
    await fireEvent.press(screen.getByText(cs.auth.signIn.submit));

    expect(signIn).toHaveBeenCalledWith({ email: "owner@dev.local", password: "a-password" });
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("signs in through the form's test ids", async () => {
    speakCzech();

    await renderSignIn();
    await unfold();

    await fireEvent.changeText(screen.getByTestId("sign-in-email"), "owner@dev.local");
    await fireEvent.changeText(screen.getByTestId("sign-in-password"), "a-password");
    await fireEvent.press(screen.getByTestId("sign-in-submit"));

    expect(signIn).toHaveBeenCalledWith({ email: "owner@dev.local", password: "a-password" });
  });

  it("signs in from the password field's return key", async () => {
    await renderSignIn();
    await unfold();

    await fillIn(en);
    await fireEvent(
      screen.getByPlaceholderText(en.auth.signIn.passwordPlaceholder),
      "submitEditing"
    );

    expect(signIn).toHaveBeenCalledWith({ email: "owner@dev.local", password: "a-password" });
  });

  it("shows the server's message when the credentials are refused", async () => {
    signIn.mockResolvedValue({ error: { message: "Invalid email or password" } });

    await renderSignIn();
    await unfold();

    await fillIn(en);
    await fireEvent.press(screen.getByText(en.auth.signIn.submit));

    expect(await screen.findByText("Invalid email or password")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("asks the server for nothing while a field is empty", async () => {
    await renderSignIn();
    await unfold();

    await fireEvent.press(screen.getByText(en.auth.signIn.submit));

    expect(signIn).not.toHaveBeenCalled();
  });

  it("asks for the password reset from the password label row", async () => {
    await renderSignIn();
    await unfold();

    await fireEvent.press(screen.getByText(en.auth.signIn.forgot));

    expect(onForgotPassword).toHaveBeenCalled();
  });

  it("hides the password until the eye is tapped", async () => {
    await renderSignIn();
    await unfold();

    const password = screen.getByPlaceholderText(en.auth.signIn.passwordPlaceholder);
    expect(password.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByLabelText(en.auth.signIn.showPassword));

    expect(password.props.secureTextEntry).toBe(false);
  });
});
