import { render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import NotificationsRoute from "@/app/notifications";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";

const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("react-native-gesture-handler", () => {
  const { View } = jest.requireActual("react-native");
  return { GestureHandlerRootView: View };
});
jest.mock("@/components/notifications/notifications-screen", () => {
  const { Text } = jest.requireActual("react-native");
  return { NotificationsScreen: () => <Text>notification list</Text> };
});

function renderRoute(route: RootRoute = "signed-in") {
  return render(
    <RootRouteProvider route={route}>
      <NotificationsRoute />
    </RootRouteProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
});

describe("NotificationsRoute", () => {
  it("renders the list over the shell", async () => {
    await renderRoute();

    expect(screen.getByText("notification list")).toBeOnTheScreen();
  });

  it("sends a visitor without a session to welcome", async () => {
    await renderRoute("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell under a cold deep link and comes back on top", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderRoute();

    expect(screen.queryByText("notification list")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith("/notifications");
  });
});
