import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

import NotificationsIntroRoute from "@/app/notifications-intro";
import { TranslationProvider } from "@/i18n/use-translation";
import { reminderPrefs } from "@/lib/reminders";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  Stack: { Screen: () => null },
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));
jest.mock("@/lib/reminders", () => {
  const device = jest.requireActual("@/lib/reminders/device");
  return {
    notificationPermission: device.notificationPermission,
    reminderPrefs: device.reminderPrefs,
  };
});
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
});

function renderRoute(route: RootRoute = "signed-in") {
  return render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <NotificationsIntroRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

describe("NotificationsIntro route", () => {
  it("counts as seen the moment it shows", async () => {
    await renderRoute();

    expect(reminderPrefs.introSeen()).toBe(true);
  });

  it("shows the iOS prompt on Continue and goes back", async () => {
    await renderRoute();

    await act(async () => fireEvent.press(screen.getByTestId("notifications-intro-continue")));

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("sends a signed-out visitor to welcome", async () => {
    await renderRoute("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });
});
