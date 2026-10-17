import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

import { PushClient } from "@/components/push/push-client";
import { TranslationProvider } from "@/i18n/use-translation";
import { deviceAppState } from "@/lib/app-state";
import { pull } from "@/lib/local-store";
import { queryClient } from "@/lib/query";
import type { FakeAppState } from "@/test-support/fake-app-state";

const mockFetch = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), navigate: jest.fn(), dismissAll: jest.fn(), canDismiss: () => false },
}));
jest.mock("expo-application", () => ({
  ApplicationReleaseType: { SIMULATOR: 1, DEVELOPMENT: 3 },
  getIosPushNotificationServiceEnvironmentAsync: jest.fn(async () => "development"),
  getIosApplicationReleaseTypeAsync: jest.fn(async () => 3),
}));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn(async () => ({ ok: true })) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

const appState = deviceAppState as FakeAppState;

const notifications = jest.requireActual("expo-notifications") as {
  getPermissionsAsync: jest.Mock;
  useLastNotificationResponse: jest.Mock;
  clearLastNotificationResponse: jest.Mock;
  addNotificationReceivedListener: jest.Mock;
  setBadgeCountAsync: jest.Mock;
};

const GRANTED = { status: "granted", granted: true, canAskAgain: true, ios: { status: 2 } };
const DENIED = { status: "denied", granted: false, canAskAgain: false, ios: { status: 1 } };
const TOKEN = "ab".repeat(32);
const REGISTRATION = "/api/users/me/push-registration";

const unread = (id: string) => ({
  id,
  type: "approval_decided",
  title: "Approved",
  body: "14 Sep to 18 Sep",
  href: null,
  readAt: null,
  createdAt: "2026-10-17T08:00:00.000Z",
});

function pushNotification(userInfo: Record<string, unknown>) {
  return {
    date: 0,
    request: {
      identifier: "apns-1",
      content: { title: "Approved", body: "14 Sep to 18 Sep", data: null },
      trigger: { type: "push", payload: { aps: { badge: 1 }, ...userInfo } },
    },
  };
}

function answer(status: number, body?: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body ?? "") };
}

const calls = (method: string, path: string) =>
  mockFetch.mock.calls.filter(
    ([url, init]) => String(url).endsWith(path) && (init?.method ?? "GET") === method
  );

// A settled write's cache timer would outlive the test run.
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

beforeEach(() => {
  jest.clearAllMocks();
  notifications.getPermissionsAsync.mockResolvedValue(GRANTED);
  notifications.useLastNotificationResponse.mockReturnValue(null);
  mockFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (String(url).endsWith("/api/notifications") && (init?.method ?? "GET") === "GET") {
      return answer(200, [unread("n-1"), unread("n-2"), { ...unread("n-3"), readAt: "x" }]);
    }
    if (String(url).includes("/api/notifications/")) return answer(204);
    return answer(204);
  });
});

afterEach(() => queryClient.clear());

async function renderClient() {
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <PushClient />
      </TranslationProvider>
    </QueryClientProvider>
  );
  await act(async () => undefined);
  return view;
}

describe("PushClient", () => {
  it("registers the token in the sandbox environment a dev client reports", async () => {
    await renderClient();

    await waitFor(() => expect(calls("PUT", REGISTRATION)).toHaveLength(1));
    expect(JSON.parse(calls("PUT", REGISTRATION)[0][1].body)).toEqual({
      token: TOKEN,
      environment: "sandbox",
    });
  });

  it("reads the permission once on a foreground and registers again", async () => {
    const view = await renderClient();
    await waitFor(() => expect(calls("PUT", REGISTRATION)).toHaveLength(1));
    notifications.getPermissionsAsync.mockClear();

    await act(async () => appState.becomeActive());

    await waitFor(() => expect(calls("PUT", REGISTRATION)).toHaveLength(2));
    expect(notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("deletes the registration when iOS reports permission revoked", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(DENIED);

    await renderClient();

    await waitFor(() => expect(calls("DELETE", REGISTRATION)).toHaveLength(1));
  });

  it("sets the app badge to the unread count the server answers", async () => {
    await renderClient();

    await waitFor(() => expect(notifications.setBadgeCountAsync).toHaveBeenCalledWith(2));
  });

  it("marks a tapped push read and opens the request it is about", async () => {
    notifications.useLastNotificationResponse.mockReturnValue({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: pushNotification({
        notificationId: "n-1",
        href: "https://flexi-day.com/requests/?vacationId=v-42",
      }),
    });

    await renderClient();

    await waitFor(() => expect(calls("POST", "/api/notifications/n-1/read")).toHaveLength(1));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/requests/[vacationId]",
      params: { vacationId: "v-42" },
    });
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalled();
    await waitFor(() =>
      expect(calls("GET", "/api/notifications").length).toBeGreaterThanOrEqual(2)
    );
  });

  it("leaves a tapped clock reminder to the reminders", async () => {
    notifications.useLastNotificationResponse.mockReturnValue({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: {
        date: 0,
        request: {
          identifier: "clock-in:2026-10-19",
          content: { title: "Clock in", data: { url: "/clock" } },
          trigger: { type: "date", value: 1 },
        },
      },
    });

    await renderClient();

    expect(router.push).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
  });

  it("pulls a refresh and reads the notifications again when a push arrives in the foreground", async () => {
    await renderClient();
    await waitFor(() => expect(calls("GET", "/api/notifications")).toHaveLength(1));
    const [onReceived] = notifications.addNotificationReceivedListener.mock.calls[0];

    await act(async () => onReceived(pushNotification({ notificationId: "n-4" })));

    expect(pull).toHaveBeenCalledWith("refresh");
    await waitFor(() => expect(calls("GET", "/api/notifications")).toHaveLength(2));
  });
});
