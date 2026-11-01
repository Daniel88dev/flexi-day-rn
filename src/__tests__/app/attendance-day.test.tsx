import { render, screen } from "@testing-library/react-native";

import Screen from "@/app/attendance/[date]";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { attendance } from "@/test-support/attendance";

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

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    router: { navigate: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => ({ date: "2026-09-24" }),
    useNavigation: () => ({ canGoBack: mockCanGoBack }),
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
    Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
  };
});

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

afterEach(() => queryClient.clear());

async function renderScreen(route: RootRoute) {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <Screen />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockFetch.mockImplementation(async (url: string) => ({
    status: 200,
    json: async () =>
      url.includes("/current")
        ? attendance({ businessDate: "2026-09-27" })
        : url.includes("/day")
          ? { sessions: [], timezone: "Europe/Prague" }
          : { balanceMode: "DAILY", days: [] },
  }));
});

describe("Pushed Day", () => {
  it("opens the Day view on its date, with a way back and no view pill", async () => {
    await renderScreen("signed-in");

    expect(await screen.findByText("Thursday, September 24")).toBeTruthy();
    expect(screen.getByTestId("stack-back")).toBeTruthy();
    expect(screen.queryByTestId("attendance-view-day")).toBeNull();
    expect(await screen.findByText("Nothing was recorded on this day.")).toBeTruthy();
  });

  it("sends a cold deep link to My attendance on the same date", async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderScreen("signed-in");

    expect(screen.getByText("/my-attendance?date=2026-09-24")).toBeTruthy();
  });

  it("sends a visitor without a session to welcome", async () => {
    await renderScreen("welcome");

    expect(screen.getByText("/welcome")).toBeTruthy();
  });
});
