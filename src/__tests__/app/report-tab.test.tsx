import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";

import ReportTabRoute from "@/app/(app)/report-tab";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { ownerOverview, ownerScope } from "@/test-support/report";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => false);

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  useFocusEffect: () => undefined,
}));

jest.mock("@/components/notifications/notification-bell", () => {
  const { View } = jest.requireActual("react-native");
  return { NotificationBell: () => <View testID="notification-bell" /> };
});
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
  getCalendars: () => [{ uses24hourClock: true }],
}));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

// The shell's query layer sits above a tab; the provider stands in for it.
async function renderTab() {
  await render(
    <QueryClientProvider client={queryClient}>
      <RootRouteProvider route="signed-in">
        <TranslationProvider>
          <ReportTabRoute />
        </TranslationProvider>
      </RootRouteProvider>
    </QueryClientProvider>
  );
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: new Date(2026, 9, 4, 10),
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
    ],
  });
  mockFetch.mockImplementation(async (url: string) => {
    const body = url.includes("/api/reports/scope")
      ? ownerScope
      : url.includes("/api/reports/overview")
        ? ownerOverview
        : {};
    return { status: 200, json: async () => body };
  });
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

describe("Report tab", () => {
  it("heads the screen with its title and the bell, and no back button", async () => {
    await renderTab();

    const tab = screen.getByTestId("report-tab");
    expect(within(tab).getByText("Report")).toBeOnTheScreen();
    expect(within(tab).getByTestId("notification-bell")).toBeOnTheScreen();
    expect(screen.queryByTestId("stack-back")).toBeNull();
  });

  it("shows the overview the Report page shows", async () => {
    await renderTab();

    expect(await screen.findByTestId("people-g-support")).toBeOnTheScreen();
  });

  it("renders in place, with no shell to put underneath it", async () => {
    await renderTab();

    await screen.findByTestId("people-g-support");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("pushes the member route over the shell when a row is tapped", async () => {
    await renderTab();

    await fireEvent.press(await screen.findByTestId("member-row-u-erin"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/report/[userId]",
      params: { userId: "u-erin", period: "rolling" },
    });
  });
});
