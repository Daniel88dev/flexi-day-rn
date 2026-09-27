import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Linking, Share } from "react-native";

import TwoFactorRoute from "@/app/settings/two-factor";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { authClient } from "@/lib/session/auth-client";
import type { TwoFactorSettingsAuth } from "@/lib/session/use-two-factor-flow";
import { twoFactorMocks } from "@/test-support/two-factor";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockCanGoBack = jest.fn(() => true);
const mockParams = jest.fn<{ flow?: string }, []>(() => ({ flow: "enable" }));
const mockScreenOptions = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  useLocalSearchParams: () => mockParams(),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
  Stack: {
    Screen: ({ options }: { options: object }) => {
      mockScreenOptions(options);
      return null;
    },
  },
}));
jest.mock("@/lib/session/auth-client", () => ({
  authClient: {
    getSession: jest.fn(),
    twoFactor: {
      enable: jest.fn(),
      getTotpUri: jest.fn(),
      generateBackupCodes: jest.fn(),
      disable: jest.fn(),
      sendOtp: jest.fn(),
      verifyTotp: jest.fn(),
      verifyOtp: jest.fn(),
    },
  },
}));
jest.mock("@/lib/session/signed-out-wipe", () => {
  const wipe = jest.fn(async () => undefined);
  return { signedOutWipe: wipe, useSignedOutWipe: () => wipe };
});
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const twoFactor = twoFactorMocks<TwoFactorSettingsAuth>(authClient);
const getSession = authClient.getSession as unknown as jest.Mock;
const copy = en.settings.twoFactor;

const URI =
  "otpauth://totp/Flexi%20Day:dana%40northwind.co?secret=JBSWY3DPEHPK3PXPJBSWY3DP&issuer=Flexi+Day&digits=6&period=30";
const CODES = ["aaaaa-bbbbb", "ccccc-ddddd", "eeeee-fffff"];

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockParams.mockReturnValue({ flow: "enable" });
  getSession.mockResolvedValue({ data: { session: { id: "new" } }, error: null });
  twoFactor.enable.mockResolvedValue({
    data: { method: "totp", totpURI: URI, backupCodes: CODES },
    error: null,
  });
  twoFactor.getTotpUri.mockResolvedValue({ data: { totpURI: URI }, error: null });
  twoFactor.generateBackupCodes.mockResolvedValue({ data: { backupCodes: CODES }, error: null });
  twoFactor.disable.mockResolvedValue({ data: { status: true }, error: null });
  twoFactor.sendOtp.mockResolvedValue({ data: { status: true }, error: null });
  twoFactor.verifyTotp.mockResolvedValue({ data: { token: "new" }, error: null });
  twoFactor.verifyOtp.mockResolvedValue({ data: { token: "new" }, error: null });
});

function renderRoute(route: RootRoute = "signed-in") {
  return render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <TwoFactorRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

async function press(testID: string) {
  await act(async () => fireEvent.press(screen.getByTestId(testID)));
}

async function enterPassword(password = "my password") {
  await fireEvent.changeText(screen.getByTestId("two-factor-password"), password);
  await press("two-factor-continue");
}

async function typeCode(code: string) {
  await act(async () => fireEvent.changeText(screen.getByLabelText(copy.code), code));
}

const lastOptions = () => mockScreenOptions.mock.calls.at(-1)?.[0];

describe("Two-factor sheet", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderRoute("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("sends a cold deep link, or a flow it does not know, to the dashboard", async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderRoute();
    expect(screen.getByText("/dashboard")).toBeOnTheScreen();

    mockCanGoBack.mockReturnValue(true);
    mockParams.mockReturnValue({ flow: "verify" });
    await renderRoute();
    expect(screen.getAllByText("/dashboard").length).toBeGreaterThan(0);
  });

  it("enables with an authenticator link, the secret and a code, then says it is on", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderRoute();
    expect(screen.getByText(copy.enable)).toBeOnTheScreen();

    await enterPassword();
    expect(twoFactor.enable).toHaveBeenCalledWith({ password: "my password", method: "totp" });
    for (const code of CODES) expect(screen.getByText(code)).toBeOnTheScreen();

    await press("two-factor-codes-saved");
    await press("two-factor-method-totp");

    expect(screen.getByTestId("two-factor-secret")).toHaveTextContent(
      "JBSW Y3DP EHPK 3PXP JBSW Y3DP"
    );
    await press("two-factor-add-to-authenticator");
    expect(openURL).toHaveBeenCalledWith(URI);

    await typeCode("123456");

    expect(twoFactor.verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText(copy.enabledTitle)).toBeOnTheScreen();

    await press("two-factor-finish");
    expect(router.back).toHaveBeenCalled();
  });

  it("tells the person when no app opens the authenticator link", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("No app"));
    await renderRoute();

    await enterPassword();
    await press("two-factor-codes-saved");
    await press("two-factor-method-totp");
    await press("two-factor-add-to-authenticator");

    expect(screen.getByText(copy.noAuthenticator)).toBeOnTheScreen();
  });

  it("copies and shares the backup codes, one per line", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    await renderRoute();
    await enterPassword();

    await press("two-factor-copy-codes");
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(CODES.join("\n"));
    expect(screen.getByText(copy.copied)).toBeOnTheScreen();

    await press("two-factor-share-codes");
    expect(share).toHaveBeenCalledWith({ message: CODES.join("\n") });
  });

  it("enables with an emailed code and offers to send it again", async () => {
    await renderRoute();
    await enterPassword();
    await press("two-factor-codes-saved");
    await press("two-factor-method-otp");

    expect(twoFactor.sendOtp).toHaveBeenCalledTimes(1);
    expect(screen.getByText(copy.otpTitle)).toBeOnTheScreen();
    expect(screen.getByText(copy.sent)).toBeOnTheScreen();

    await press("two-factor-resend");
    expect(twoFactor.sendOtp).toHaveBeenCalledTimes(2);

    await typeCode("654321");
    expect(twoFactor.verifyOtp).toHaveBeenCalledWith({ code: "654321" });
    expect(screen.getByText(copy.enabledTitle)).toBeOnTheScreen();
  });

  it("shows a wrong password inline", async () => {
    twoFactor.enable.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_PASSWORD", message: "Invalid password" },
    });
    await renderRoute();

    await enterPassword("wrong");

    expect(screen.getByTestId("two-factor-password-error")).toHaveTextContent(
      copy.errors.wrongPassword
    );
  });

  it("shows a refused code under the code boxes", async () => {
    twoFactor.verifyTotp.mockResolvedValue({
      data: null,
      error: { status: 401, code: "INVALID_CODE", message: "Invalid code" },
    });
    mockParams.mockReturnValue({ flow: "authenticator" });
    await renderRoute();

    await enterPassword();
    await typeCode("000000");

    expect(screen.getByTestId("two-factor-code-error")).toHaveTextContent(
      en.auth.twoFactor.errors.invalidCode
    );
  });

  it("sets up an authenticator from the existing secret, then says it is linked", async () => {
    mockParams.mockReturnValue({ flow: "authenticator" });
    await renderRoute();

    await enterPassword();
    expect(twoFactor.getTotpUri).toHaveBeenCalledWith({ password: "my password" });
    expect(twoFactor.enable).not.toHaveBeenCalled();

    await typeCode("123456");
    expect(screen.getByText(copy.linkedTitle)).toBeOnTheScreen();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("keeps fresh backup codes on screen until the person says they saved them", async () => {
    mockParams.mockReturnValue({ flow: "backupCodes" });
    await renderRoute();
    expect(lastOptions()).toEqual({ gestureEnabled: true });

    await enterPassword();

    expect(twoFactor.generateBackupCodes).toHaveBeenCalledWith({ password: "my password" });
    expect(lastOptions()).toEqual({ gestureEnabled: false });
    expect(screen.queryByTestId("two-factor-cancel")).toBeNull();

    await press("two-factor-codes-saved");
    expect(router.back).toHaveBeenCalled();
  });

  it("disables with the password, reads the session back and says it is off", async () => {
    mockParams.mockReturnValue({ flow: "disable" });
    await renderRoute();
    expect(screen.getByText(`${copy.disableHint} ${copy.passwordHint}`)).toBeOnTheScreen();

    await enterPassword();

    expect(twoFactor.disable).toHaveBeenCalledWith({ password: "my password" });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText(copy.disabledTitle)).toBeOnTheScreen();
  });

  it("closes from Cancel", async () => {
    await renderRoute();

    await press("two-factor-cancel");

    expect(router.back).toHaveBeenCalled();
  });
});
