import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import TwoFactorScreen from "@/app/(auth)/two-factor";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { authClient } from "@/lib/session/auth-client";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { acceptEveryCode, twoFactorMocks } from "@/test-support/two-factor";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
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

const params = useLocalSearchParams as unknown as jest.Mock;
const back = router.back as jest.Mock;
const twoFactor = twoFactorMocks(authClient);

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
  acceptEveryCode(twoFactor);
});

function renderTwoFactor() {
  return render(
    <RootRouteProvider route="welcome">
      <TranslationProvider>
        <TwoFactorScreen />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

describe("TwoFactorScreen", () => {
  it("offers every method the sign-in response listed", async () => {
    params.mockReturnValue({ methods: "totp,otp" });

    await renderTwoFactor();

    expect(screen.getByText(en.auth.twoFactor.totpDescription)).toBeTruthy();
    expect(screen.getByText(en.auth.twoFactor.useEmail)).toBeTruthy();
    expect(screen.getByText(en.auth.twoFactor.useBackup)).toBeTruthy();
  });

  it("starts on the emailed code when the authenticator was not offered", async () => {
    params.mockReturnValue({ methods: "otp" });

    await renderTwoFactor();

    await waitFor(() => expect(twoFactor.sendOtp).toHaveBeenCalledTimes(1));
    expect(screen.getByText(en.auth.twoFactor.otpDescription)).toBeTruthy();
    expect(screen.queryByText(en.auth.twoFactor.useAuthenticator)).toBeNull();
  });

  it("falls back to the emailed code when the sign-in response listed nothing", async () => {
    await renderTwoFactor();

    await waitFor(() => expect(twoFactor.sendOtp).toHaveBeenCalledTimes(1));
    expect(screen.getByText(en.auth.twoFactor.otpDescription)).toBeTruthy();
  });

  it("goes back to sign-in from the header and the footer link", async () => {
    params.mockReturnValue({ methods: "totp" });

    await renderTwoFactor();

    await fireEvent.press(screen.getByLabelText(en.auth.signIn.back));
    await fireEvent.press(screen.getByText(en.auth.twoFactor.backToSignIn));

    expect(back).toHaveBeenCalledTimes(2);
  });
});
