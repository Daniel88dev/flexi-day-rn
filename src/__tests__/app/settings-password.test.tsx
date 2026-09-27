import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import PasswordRoute from "@/app/settings/password";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { authClient } from "@/lib/session/auth-client";
import { signedOutWipe } from "@/lib/session/signed-out-wipe";

const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));
jest.mock("@/lib/session/auth-client", () => ({
  authClient: { changePassword: jest.fn(), getSession: jest.fn() },
}));
jest.mock("@/lib/session/signed-out-wipe", () => {
  const wipe = jest.fn(async () => undefined);
  return { signedOutWipe: wipe, useSignedOutWipe: () => wipe };
});
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const changePassword = authClient.changePassword as unknown as jest.Mock;
const getSession = authClient.getSession as unknown as jest.Mock;
const wipe = signedOutWipe as unknown as jest.Mock;
const copy = en.settings.password;

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  changePassword.mockResolvedValue({ data: { token: "new-token" }, error: null });
  getSession.mockResolvedValue({ data: { session: { id: "new" } }, error: null });
});

function renderRoute(route: RootRoute = "signed-in") {
  return render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <PasswordRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

async function fillIn(current: string, next: string, confirm = next) {
  await fireEvent.changeText(screen.getByTestId("password-current"), current);
  await fireEvent.changeText(screen.getByTestId("password-next"), next);
  await fireEvent.changeText(screen.getByTestId("password-confirm"), confirm);
}

async function submit() {
  await act(async () => fireEvent.press(screen.getByTestId("password-submit")));
}

describe("Change password", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderRoute("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell under a screen a cold deep link opened on its own", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderRoute();

    expect(screen.getByText("/dashboard")).toBeOnTheScreen();
  });

  it("hints password AutoFill: the current password, then a new one twice", async () => {
    await renderRoute();

    expect(screen.getByTestId("password-current")).toHaveProp("textContentType", "password");
    expect(screen.getByTestId("password-current")).toHaveProp("autoComplete", "current-password");
    for (const testID of ["password-next", "password-confirm"]) {
      expect(screen.getByTestId(testID)).toHaveProp("textContentType", "newPassword");
      expect(screen.getByTestId(testID)).toHaveProp("autoComplete", "new-password");
    }
    expect(screen.getByTestId("password-submit")).toBeDisabled();
  });

  it("shows a mismatched confirmation under the confirm field", async () => {
    await renderRoute();

    await fillIn("old password", "new password", "new passwort");
    await submit();

    expect(screen.getByTestId("password-confirm-error")).toHaveTextContent(copy.errors.mismatch);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("shows a wrong current password under the current field", async () => {
    changePassword.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_PASSWORD", message: "Invalid password" },
    });
    await renderRoute();

    await fillIn("not it", "new password");
    await submit();

    expect(screen.getByTestId("password-current-error")).toHaveTextContent(
      copy.errors.wrongCurrent
    );
    expect(getSession).not.toHaveBeenCalled();
  });

  it("changes the password, keeps this phone signed in, and goes back on Done", async () => {
    await renderRoute();

    await fillIn("old password", "new password");
    await submit();

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "old password",
      newPassword: "new password",
      revokeOtherSessions: true,
    });
    expect(getSession).toHaveBeenCalled();
    expect(wipe).not.toHaveBeenCalled();
    expect(screen.getByText(copy.changed)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("password-done"));
    expect(router.back).toHaveBeenCalled();
  });

  it("signs the phone out when the session lookup after the change finds none", async () => {
    getSession.mockResolvedValue({ data: null, error: null });
    await renderRoute();

    await fillIn("old password", "new password");
    await submit();

    expect(wipe).toHaveBeenCalled();
  });
});
