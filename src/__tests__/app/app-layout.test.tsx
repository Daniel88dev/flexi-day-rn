import { render, screen } from "@testing-library/react-native";

import AppLayout from "@/app/(app)/_layout";
import { openStore } from "@/lib/local-store";
import { authClient } from "@/lib/session/auth-client";
import { SESSION, VIEWER } from "@/test-support/session";
import { TranslationProvider } from "@/i18n/use-translation";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import type { RootRoute } from "@/lib/session/root-route";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("expo-router/ui", () => {
  const { View } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  const passthrough = (testID: string) => {
    const Passthrough = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, { testID }, children);
    Passthrough.displayName = testID;
    return Passthrough;
  };
  return {
    Tabs: passthrough("tabs"),
    TabList: passthrough("tab-list"),
    TabSlot: passthrough("tab-slot"),
    TabTrigger: passthrough("tab-trigger"),
  };
});

jest.mock("@/lib/local-store", () => ({
  openStore: jest.fn().mockResolvedValue(undefined),
  destroyStore: jest.fn(),
}));

jest.mock("sonner-native", () => ({ Toaster: () => null }));

jest.mock("@/lib/session/auth-client", () => ({ authClient: { useSession: jest.fn() } }));

jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: jest.requireActual("react-native").View,
}));

function renderShell(route: RootRoute) {
  return render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <AppLayout />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

const open = openStore as jest.MockedFunction<typeof openStore>;
const useSession = authClient.useSession as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useSession.mockReturnValue(SESSION);
});

describe("AppLayout", () => {
  it("sends a visitor without a session to welcome, opening no Local store on the way", async () => {
    await renderShell("welcome");

    expect(screen.getByText("/welcome")).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
  });

  it("keeps a phone with a cached session in the shell", async () => {
    await renderShell("signed-in");

    expect(screen.queryByText("/welcome")).toBeNull();
    expect(screen.getByTestId("tab-slot")).toBeTruthy();
    expect(open).toHaveBeenCalledWith(VIEWER.id, expect.anything());
  });
});
