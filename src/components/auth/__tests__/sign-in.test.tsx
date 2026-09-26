import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { SignIn } from "@/components/auth/sign-in";
import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { authClient } from "@/lib/session/auth-client";
import { RootRouteProvider } from "@/lib/session/root-route-context";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock("@/lib/session/auth-client", () => ({
  authClient: { signIn: { email: jest.fn() } },
}));

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

const getLocales = jest.requireMock("expo-localization").getLocales as jest.Mock;
const signIn = authClient.signIn.email as unknown as jest.Mock;
const replace = router.replace as jest.Mock;

const onBack = jest.fn();
const onForgotPassword = jest.fn();
const onCreateAccount = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getLocales.mockReturnValue([{ languageCode: "en" }]);
  signIn.mockResolvedValue({ data: { token: "a-token" } });
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
  it("renders the form the web's sign-in card carries", async () => {
    await renderSignIn();

    expect(screen.getByText(en.auth.signIn.title)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.description)).toBeTruthy();
    expect(screen.getByText(en.auth.workEmail)).toBeTruthy();
    expect(screen.getByText(en.auth.password)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.forgot)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.submit)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.socialHintLink)).toBeTruthy();
    expect(screen.getByText(en.auth.signIn.createTeam)).toBeTruthy();
  });

  it("renders the form in Czech for a phone set to Czech", async () => {
    speakCzech();

    await renderSignIn();

    expect(screen.getByText(cs.auth.signIn.title)).toBeTruthy();
    expect(screen.getByText(cs.auth.signIn.description)).toBeTruthy();
    expect(screen.getByText(cs.auth.workEmail)).toBeTruthy();
    expect(screen.getByText(cs.auth.signIn.submit)).toBeTruthy();
  });

  it("signs in with what was typed and lands on the dashboard", async () => {
    await renderSignIn();

    await fillIn(en);
    await fireEvent.press(screen.getByText(en.auth.signIn.submit));

    expect(signIn).toHaveBeenCalledWith({ email: "owner@dev.local", password: "a-password" });
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("signs in in Czech too", async () => {
    speakCzech();

    await renderSignIn();

    await fillIn(cs);
    await fireEvent.press(screen.getByText(cs.auth.signIn.submit));

    expect(signIn).toHaveBeenCalledWith({ email: "owner@dev.local", password: "a-password" });
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("signs in through the ids the Maestro flows drive", async () => {
    speakCzech();

    await renderSignIn();

    await fireEvent.changeText(screen.getByTestId("sign-in-email"), "owner@dev.local");
    await fireEvent.changeText(screen.getByTestId("sign-in-password"), "a-password");
    await fireEvent.press(screen.getByTestId("sign-in-submit"));

    expect(signIn).toHaveBeenCalledWith({ email: "owner@dev.local", password: "a-password" });
  });

  it("signs in from the password field's return key", async () => {
    await renderSignIn();

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

    await fillIn(en);
    await fireEvent.press(screen.getByText(en.auth.signIn.submit));

    expect(await screen.findByText("Invalid email or password")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("asks the server for nothing while a field is empty", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByText(en.auth.signIn.submit));

    expect(signIn).not.toHaveBeenCalled();
  });

  it("asks for the password reset from the password label row", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByText(en.auth.signIn.forgot));

    expect(onForgotPassword).toHaveBeenCalled();
  });

  it("asks for the password reset from the Google and Microsoft hint", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByText(en.auth.signIn.socialHintLink));

    expect(onForgotPassword).toHaveBeenCalled();
  });

  it("asks for the web sign-up from the footer", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByText(en.auth.signIn.createTeam));

    expect(onCreateAccount).toHaveBeenCalled();
  });

  it("goes back from the back button", async () => {
    await renderSignIn();

    await fireEvent.press(screen.getByLabelText(en.auth.signIn.back));

    expect(onBack).toHaveBeenCalled();
  });

  it("hides the password until the eye is tapped", async () => {
    await renderSignIn();

    const password = screen.getByPlaceholderText(en.auth.signIn.passwordPlaceholder);
    expect(password.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByLabelText(en.auth.signIn.showPassword));

    expect(password.props.secureTextEntry).toBe(false);
  });
});
