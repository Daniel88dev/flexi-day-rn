import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { ActionSheetIOS, Linking } from "react-native";

import { router } from "expo-router";

import SettingsRoute from "@/app/settings";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { useRequestScopeGroups } from "@/lib/local-store";
import { queryClient } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { authClient } from "@/lib/session/auth-client";
import { reminderPrefs } from "@/lib/reminders";
import { attendance, workingMonth } from "@/test-support/attendance";
import { SESSION } from "@/test-support/session";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/session/auth-client", () => ({
  sessionCookie: async () => "",
  authClient: { useSession: jest.fn(), listAccounts: jest.fn() },
}));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({
  pull: jest.fn().mockResolvedValue({ ok: true }),
  useRequestScopeGroups: jest.fn(),
}));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-application", () => ({
  nativeApplicationVersion: "1.2.0",
  nativeBuildVersion: "45",
}));
jest.mock("@react-native-community/datetimepicker", () => {
  const { Pressable } = jest.requireActual("react-native");
  return function DateTimePicker(props: {
    testID: string;
    value: Date;
    onValueChange: (event: unknown, date: Date) => void;
  }) {
    return (
      <Pressable
        testID={props.testID}
        accessibilityValue={{ text: props.value.toTimeString().slice(0, 5) }}
        onPress={() => {
          const later = new Date(props.value);
          later.setMinutes(later.getMinutes() + 30);
          props.onValueChange({ type: "set" }, later);
        }}
      />
    );
  };
});
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: "dismiss" }),
  WebBrowserPresentationStyle: { PAGE_SHEET: "pageSheet" },
}));

const useSession = authClient.useSession as unknown as jest.Mock;
const listAccounts = authClient.listAccounts as unknown as jest.Mock;

const PASSWORD_ACCOUNT = { providerId: "credential" };
const GOOGLE_ACCOUNT = { providerId: "google" };
const scopeGroups = useRequestScopeGroups as jest.MockedFunction<typeof useRequestScopeGroups>;

const STORED = {
  emailNotifications: true,
  dashboardScope: "MINE",
  dashboardGroupId: null,
  dashboardCalendarView: "LANES",
  attendanceLocationNoticeDismissed: false,
};

// A finished mutation waits five minutes to be collected, and that timer keeps Jest running.
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  useSession.mockReturnValue(SESSION);
  listAccounts.mockResolvedValue({ data: [GOOGLE_ACCOUNT, PASSWORD_ACCOUNT], error: null });
  scopeGroups.mockReturnValue([{ groupId: "g-1", groupName: "Design" }]);
  let stored = { ...STORED };
  mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") stored = { ...stored, ...JSON.parse(String(init.body)) };
    return answer(200, stored);
  });
});

afterEach(() => queryClient.clear());

function renderSettings(route: RootRoute = "signed-in") {
  return render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <SettingsRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

async function renderLoaded() {
  await renderSettings();
  await waitFor(() =>
    expect(screen.getByTestId("settings-email-switch")).toHaveProp("disabled", false)
  );
}

describe("Settings", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderSettings("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell under a screen a cold deep link opened on its own", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderSettings();

    expect(screen.getByText("/dashboard")).toBeOnTheScreen();
  });

  it("renders the account, Notifications, Dashboard calendar, Security, Language, About and Delete account in that order", async () => {
    await renderLoaded();
    await screen.findByTestId("settings-security");

    const tree = JSON.stringify(screen.toJSON());
    const order = [
      "settings-account",
      "settings-notifications",
      "settings-dashboard",
      "settings-security",
      "settings-language-section",
      "settings-about",
      "settings-delete-account-section",
    ].map((testID) => tree.indexOf(`"testID":"${testID}"`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(screen.getByText(SESSION.data.user.name)).toBeOnTheScreen();
    expect(screen.getByText(SESSION.data.user.email)).toBeOnTheScreen();
  });

  it("saves the email switch as soon as it changes", async () => {
    await renderLoaded();

    await act(async () =>
      fireEvent(screen.getByTestId("settings-email-switch"), "valueChange", false)
    );

    const put = mockFetch.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1].body))).toEqual({ emailNotifications: false });
    await waitFor(() =>
      expect(screen.getByTestId("settings-email-switch")).toHaveProp("value", false)
    );
  });

  it("saves Group as the dashboard default with the group the viewer sees", async () => {
    await renderLoaded();

    await act(async () => fireEvent.press(screen.getByTestId("settings-scope-group")));

    const put = mockFetch.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1].body))).toEqual({
      dashboardScope: "GROUP",
      dashboardGroupId: "g-1",
    });
  });

  it("pushes the password screen from Change password for an account with a password", async () => {
    await renderLoaded();

    await fireEvent.press(await screen.findByTestId("settings-change-password"));

    expect(router.push).toHaveBeenCalledWith("/settings/password");
    expect(screen.getByText(en.settings.signsOutOthers)).toBeOnTheScreen();
  });

  it("leaves Security out for an account that only signs in with Google or Microsoft", async () => {
    listAccounts.mockResolvedValue({ data: [GOOGLE_ACCOUNT], error: null });
    await renderLoaded();

    await waitFor(() => expect(listAccounts).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.queryByTestId("settings-security")).toBeNull();
    expect(screen.queryByTestId("settings-two-factor")).toBeNull();
  });

  it("shows Two-factor as Off and opens the enable sheet from it", async () => {
    await renderLoaded();

    const row = await screen.findByTestId("settings-two-factor");
    expect(row).toHaveTextContent(new RegExp(en.settings.twoFactor.off));
    await fireEvent.press(row);

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/settings/two-factor",
      params: { flow: "enable" },
    });
  });

  it("shows Two-factor as On and offers its three flows, Turn off last", async () => {
    useSession.mockReturnValue({
      data: { user: { ...SESSION.data.user, twoFactorEnabled: true } },
    });
    const sheet = jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation((_options, pick) => pick(2));
    await renderLoaded();

    const row = await screen.findByTestId("settings-two-factor");
    expect(row).toHaveTextContent(new RegExp(en.settings.twoFactor.on));
    await fireEvent.press(row);

    const [options] = sheet.mock.calls[0];
    expect(options.options).toEqual([
      en.settings.twoFactor.setupTotp,
      en.settings.twoFactor.regenerateBackup,
      en.settings.twoFactor.disable,
      en.settings.twoFactor.cancel,
    ]);
    expect(options.destructiveButtonIndex).toBe(2);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/settings/two-factor",
      params: { flow: "disable" },
    });
  });

  it("offers Change password anyway when the account list cannot be read", async () => {
    listAccounts.mockResolvedValue({ data: null, error: { status: 500, message: "boom" } });
    await renderLoaded();

    expect(
      await screen.findByTestId("settings-change-password", {}, { timeout: 5000 })
    ).toBeOnTheScreen();
  });

  it("opens the app's page in iOS Settings from Language", async () => {
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    await renderLoaded();

    expect(screen.getByTestId("settings-language")).toHaveTextContent(/English/);
    await fireEvent.press(screen.getByTestId("settings-language"));

    expect(openSettings).toHaveBeenCalled();
  });

  it("shows the version and build and opens the legal pages in a sheet", async () => {
    await renderLoaded();

    expect(screen.getByTestId("settings-version")).toHaveTextContent(/1\.2\.0 \(45\)/);
    await fireEvent.press(screen.getByTestId("settings-privacy"));
    await fireEvent.press(screen.getByTestId("settings-terms"));

    const urls = (WebBrowser.openBrowserAsync as jest.Mock).mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      expect.stringMatching(/\/privacy\/$/),
      expect.stringMatching(/\/terms\/$/),
    ]);
  });

  it("opens the Delete account sheet from the last row", async () => {
    await renderLoaded();

    expect(screen.getByTestId("settings-delete-account")).toHaveTextContent(
      en.settings.deleteAccount.row
    );
    await fireEvent.press(screen.getByTestId("settings-delete-account"));

    expect(router.push).toHaveBeenCalledWith("/settings/delete-account");
  });

  it("goes back to where More opened it", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByTestId("stack-back"));

    expect(router.back).toHaveBeenCalled();
  });

  it("offers Retry while the settings cannot be read", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    await renderSettings();

    expect(await screen.findByText(en.sync.unreachable, {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.getByTestId("settings-email-switch")).toHaveProp("disabled", true);
    mockFetch.mockResolvedValue(answer(200, STORED));
    await act(async () => fireEvent.press(screen.getByTestId("settings-retry")));

    await waitFor(() =>
      expect(screen.getByTestId("settings-email-switch")).toHaveProp("disabled", false)
    );
  });
});

describe("Settings, phone notifications and Clock reminders", () => {
  const notifications = jest.requireActual("expo-notifications") as {
    getPermissionsAsync: jest.Mock;
    requestPermissionsAsync: jest.Mock;
  };
  const GRANTED = { status: "granted", granted: true, canAskAgain: true, ios: { status: 2 } };
  const DENIED = { status: "denied", granted: false, canAskAgain: false, ios: { status: 1 } };
  const UNDETERMINED = {
    status: "undetermined",
    granted: false,
    canAskAgain: true,
    ios: { status: 0 },
  };

  function answerAttendance(current: unknown) {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/attendance/current")) {
        return current === 404 ? answer(404, { message: "No Employment" }) : answer(200, current);
      }
      if (url.includes("/api/attendance/month")) {
        const month = Number(new URL(url).searchParams.get("month"));
        return answer(200, workingMonth(2026, month));
      }
      return answer(200, STORED);
    });
  }

  beforeEach(() => {
    reminderPrefs.clear();
    notifications.getPermissionsAsync.mockResolvedValue(GRANTED);
    answerAttendance(attendance({ businessDate: "2026-09-28" }));
  });

  it("shows iOS's answer on the permission row", async () => {
    await renderLoaded();

    await waitFor(() =>
      expect(screen.getByTestId("settings-notifications-permission")).toHaveTextContent(/On/)
    );
  });

  it("offers Open Settings while iOS refuses notifications", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(DENIED);
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    await renderLoaded();

    await fireEvent.press(await screen.findByTestId("settings-notifications-open-settings"));

    expect(openSettings).toHaveBeenCalled();
  });

  it("asks iOS from Turn on while it has never been asked", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(UNDETERMINED);
    await renderLoaded();

    await act(async () =>
      fireEvent.press(await screen.findByTestId("settings-notifications-turn-on"))
    );

    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("shows Clock reminders with clock-in off and clock-out on while attendance is active", async () => {
    await renderLoaded();

    expect(await screen.findByTestId("settings-clock-reminders")).toBeOnTheScreen();
    expect(screen.getByTestId("settings-reminder-clock-in")).toHaveProp("value", false);
    expect(screen.getByTestId("settings-reminder-clock-out")).toHaveProp("value", true);
    expect(screen.queryByTestId("settings-reminder-time")).toBeNull();
  });

  it("offers 08:00 on the working days when clock-in is switched on, and saves a day unticked", async () => {
    await renderLoaded();

    await act(async () =>
      fireEvent(await screen.findByTestId("settings-reminder-clock-in"), "valueChange", true)
    );

    expect(screen.getByTestId("settings-reminder-time")).toHaveAccessibilityValue({
      text: "08:00",
    });
    await waitFor(() => expect(screen.getByTestId("settings-reminder-day-5")).toBeChecked());
    expect(screen.getByTestId("settings-reminder-day-6")).not.toBeChecked();
    expect(screen.getByTestId("settings-reminder-day-6")).toBeDisabled();

    await act(async () => fireEvent.press(screen.getByTestId("settings-reminder-day-5")));
    await act(async () => fireEvent.press(screen.getByTestId("settings-reminder-time")));

    expect(reminderPrefs.read().clockIn).toEqual({
      enabled: true,
      time: "08:30",
      weekdays: [1, 2, 3, 4],
    });
  });

  it("keeps the section visible but switched off while iOS refuses notifications", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(DENIED);
    await renderLoaded();

    await waitFor(() =>
      expect(screen.getByTestId("settings-reminder-clock-out")).toHaveProp("disabled", true)
    );
    expect(screen.getByText(en.reminders.deniedHint)).toBeOnTheScreen();
  });

  it.each([
    ["attendance is off", attendance({ active: false })],
    ["the Employment ended", attendance({ employmentEnded: true })],
    ["there is no Employment", 404],
  ])("leaves Clock reminders out while %s", async (_why, current) => {
    answerAttendance(current);
    await renderLoaded();
    await act(async () => undefined);

    expect(screen.queryByTestId("settings-clock-reminders")).toBeNull();
  });
});
