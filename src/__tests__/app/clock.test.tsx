import { render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import ClockSheet from "@/app/clock";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";

const mockFetch = jest.fn();

// The factory runs before `mockFetch` is assigned, so it reaches it through a closure.
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  Stack: { Screen: () => null },
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));

// The shell and the sheet share the app's one query client; its garbage collection timers
// would outlive the test.
afterEach(() => queryClient.clear());

async function renderSheet(route: RootRoute) {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <ClockSheet />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockCanGoBack.mockReturnValue(true);
});

describe("ClockSheet", () => {
  it("sends a deep link without a session to welcome", async () => {
    await renderSheet("welcome");

    expect(screen.getByText("/welcome")).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("reads the clock for a signed-in phone", async () => {
    mockFetch.mockResolvedValue({ status: 404, json: async () => ({}) });

    await renderSheet("signed-in");

    expect(await screen.findByText("You have no attendance to clock here.")).toBeTruthy();
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/attendance\/current$/);
  });

  it("puts the shell under a sheet a cold deep link opened with nothing beneath it", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderSheet("signed-in");

    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith("/clock");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
