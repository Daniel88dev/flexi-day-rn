import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { TwoFactor } from "@/components/auth/two-factor";
import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { authClient } from "@/lib/session/auth-client";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { acceptEveryCode, twoFactorMocks } from "@/test-support/two-factor";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock("@/lib/session/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyTotp: jest.fn(),
      verifyOtp: jest.fn(),
      verifyBackupCode: jest.fn(),
      sendOtp: jest.fn(),
    },
  },
}));

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

const getLocales = jest.requireMock("expo-localization").getLocales as jest.Mock;
const twoFactor = twoFactorMocks(authClient);
const replace = router.replace as jest.Mock;

const onBack = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getLocales.mockReturnValue([{ languageCode: "en" }]);
  acceptEveryCode(twoFactor);
});

function renderTwoFactor(methods: string[] = ["totp", "otp"]) {
  return render(
    <RootRouteProvider route="welcome">
      <TranslationProvider>
        <TwoFactor methods={methods} onBack={onBack} />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

function speakCzech() {
  getLocales.mockReturnValue([{ languageCode: "cs" }]);
}

describe("TwoFactor", () => {
  it("renders the verification the web's card carries", async () => {
    await renderTwoFactor();

    expect(screen.getByText(en.auth.twoFactor.title)).toBeTruthy();
    expect(screen.getByText(en.auth.twoFactor.totpDescription)).toBeTruthy();
    expect(screen.getByLabelText(en.auth.twoFactor.code)).toBeTruthy();
    expect(screen.getByText(en.auth.twoFactor.submit)).toBeTruthy();
    expect(screen.getByText(en.auth.twoFactor.useEmail)).toBeTruthy();
    expect(screen.getByText(en.auth.twoFactor.useBackup)).toBeTruthy();
    expect(screen.getByText(en.auth.twoFactor.backToSignIn)).toBeTruthy();
  });

  it("renders the verification in Czech for a phone set to Czech", async () => {
    speakCzech();

    await renderTwoFactor();

    expect(screen.getByText(cs.auth.twoFactor.title)).toBeTruthy();
    expect(screen.getByText(cs.auth.twoFactor.totpDescription)).toBeTruthy();
    expect(screen.getByText(cs.auth.twoFactor.submit)).toBeTruthy();
  });

  it("verifies the authenticator code the moment the sixth digit lands", async () => {
    await renderTwoFactor();

    await fireEvent.changeText(screen.getByLabelText(en.auth.twoFactor.code), "123456");

    await waitFor(() => expect(twoFactor.verifyTotp).toHaveBeenCalledWith({ code: "123456" }));
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("verifies in Czech too", async () => {
    speakCzech();

    await renderTwoFactor();

    await fireEvent.changeText(screen.getByLabelText(cs.auth.twoFactor.code), "123456");

    await waitFor(() => expect(twoFactor.verifyTotp).toHaveBeenCalledWith({ code: "123456" }));
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("verifies from the primary button", async () => {
    await renderTwoFactor();

    await fireEvent.changeText(screen.getByLabelText(en.auth.twoFactor.code), "12345");
    await fireEvent.press(screen.getByText(en.auth.twoFactor.submit));

    expect(twoFactor.verifyTotp).toHaveBeenCalledWith({ code: "12345" });
  });

  it("shows the server's refusal as the web's copy", async () => {
    twoFactor.verifyTotp.mockResolvedValue({ error: { status: 401, code: "INVALID_CODE" } });

    await renderTwoFactor();

    await fireEvent.changeText(screen.getByLabelText(en.auth.twoFactor.code), "000000");

    expect(await screen.findByText(en.auth.twoFactor.errors.invalidCode)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("swaps the boxes for a backup code field when the method changes", async () => {
    await renderTwoFactor();

    await fireEvent.press(screen.getByText(en.auth.twoFactor.useBackup));

    expect(screen.getByText(en.auth.twoFactor.backupCode)).toBeTruthy();
    expect(screen.getByPlaceholderText(en.auth.twoFactor.backupPlaceholder)).toBeTruthy();
    expect(screen.getByText(en.auth.twoFactor.backupDescription)).toBeTruthy();
    expect(screen.queryByLabelText(en.auth.twoFactor.code)).toBeNull();
  });

  it("verifies a backup code from the field's return key", async () => {
    await renderTwoFactor();

    await fireEvent.press(screen.getByText(en.auth.twoFactor.useBackup));
    await fireEvent.changeText(
      screen.getByPlaceholderText(en.auth.twoFactor.backupPlaceholder),
      "abcde-fghij"
    );
    await fireEvent(
      screen.getByPlaceholderText(en.auth.twoFactor.backupPlaceholder),
      "submitEditing"
    );

    await waitFor(() =>
      expect(twoFactor.verifyBackupCode).toHaveBeenCalledWith({ code: "abcde-fghij" })
    );
  });

  it("sends the emailed code on its own and counts the resend down", async () => {
    await renderTwoFactor(["otp"]);

    await waitFor(() => expect(twoFactor.sendOtp).toHaveBeenCalledTimes(1));
    expect(screen.getByText(en.auth.twoFactor.sent)).toBeTruthy();
    expect(screen.getByText(`${en.auth.twoFactor.resend} (30)`)).toBeTruthy();
  });

  it("offers the authenticator only when the server offered it", async () => {
    await renderTwoFactor(["otp"]);

    await waitFor(() => expect(twoFactor.sendOtp).toHaveBeenCalled());
    expect(screen.queryByText(en.auth.twoFactor.useAuthenticator)).toBeNull();
  });

  it("dims the boxes and offers the way back once the challenge is dead", async () => {
    twoFactor.verifyTotp.mockResolvedValue({
      error: { status: 401, code: "INVALID_TWO_FACTOR_COOKIE" },
    });

    await renderTwoFactor();

    await fireEvent.changeText(screen.getByLabelText(en.auth.twoFactor.code), "123456");

    expect(await screen.findByText(en.auth.twoFactor.errors.challengeExpired)).toBeTruthy();
    expect(screen.getByLabelText(en.auth.twoFactor.code).props.editable).toBe(false);
    expect(screen.queryByText(en.auth.twoFactor.submit)).toBeNull();
    expect(screen.queryByText(en.auth.twoFactor.useBackup)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: en.auth.twoFactor.backToSignIn }));

    expect(onBack).toHaveBeenCalled();
  });

  it("goes back from the header and from the footer link", async () => {
    await renderTwoFactor();

    await fireEvent.press(screen.getByLabelText(en.auth.signIn.back));
    expect(onBack).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText(en.auth.twoFactor.backToSignIn));
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
