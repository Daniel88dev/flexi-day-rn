import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import AppLayout from "@/app/(app)/_layout";
import { destroyStore, openStore } from "@/lib/local-store";
import type { FakeAppState } from "@/test-support/fake-app-state";
import { authClient } from "@/lib/session/auth-client";
import { clearSignedOutNotice, signedOutNoticeShowing } from "@/lib/session/signed-out-notice";
import { SESSION, VIEWER } from "@/test-support/session";
import { TranslationProvider } from "@/i18n/use-translation";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import type { RootRoute } from "@/lib/session/root-route";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
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
  destroyStore: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

jest.mock("sonner-native", () => ({ Toaster: () => null }));

jest.mock("@/lib/session/auth-client", () => ({
  SESSION_COOKIE_KEY: "flexi-day_cookie",
  clearClientSession: jest.fn(),
  authClient: {
    useSession: jest.fn(),
    getSession: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock("expo-secure-store", () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }));

jest.mock("@better-auth/expo/client", () => ({ storageAdapter: (storage: unknown) => storage }));

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
const destroy = destroyStore as jest.MockedFunction<typeof destroyStore>;
const useSession = authClient.useSession as unknown as jest.Mock;
const getSession = authClient.getSession as unknown as jest.Mock;
const serverSignOut = authClient.signOut as unknown as jest.Mock;
const appState = jest.requireMock("@/lib/app-state").deviceAppState as FakeAppState;

/** The 401 answer the request wrapper hands the store, as the shell wired it. */
function answerUnauthorized() {
  const options = open.mock.calls[0][1];
  return act(async () => options?.onUnauthorized?.());
}

beforeEach(() => {
  jest.clearAllMocks();
  clearSignedOutNotice();
  useSession.mockReturnValue(SESSION);
  getSession.mockResolvedValue(SESSION);
  serverSignOut.mockResolvedValue({});
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

describe("AppLayout, signing the phone out", () => {
  it("wipes the phone when a request comes back unauthorized", async () => {
    await renderShell("signed-in");

    await answerUnauthorized();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(signedOutNoticeShowing()).toBe(true);
  });

  it("ends the session on the server and wipes when the More sheet asks", async () => {
    const confirm = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderShell("signed-in");

    await act(async () => fireEvent.press(screen.getByText("More")));
    await act(async () => fireEvent.press(await screen.findByText("Sign out")));
    const destructive = confirm.mock.calls[0][2]?.find((button) => button.style === "destructive");
    await act(async () => destructive?.onPress?.());

    expect(serverSignOut).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(signedOutNoticeShowing()).toBe(true);
    confirm.mockRestore();
  });

  it("revalidates the session as the shell mounts and wipes when it has gone", async () => {
    getSession.mockResolvedValue({ data: null, error: null });

    await renderShell("signed-in");

    await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
    expect(signedOutNoticeShowing()).toBe(true);
  });

  it("revalidates again on the foreground event the sync pull runs on", async () => {
    await renderShell("signed-in");
    expect(getSession).toHaveBeenCalledTimes(1);

    await act(async () => appState.becomeActive());

    expect(getSession).toHaveBeenCalledTimes(2);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("looks nothing up for a visitor the guard is sending to welcome", async () => {
    await renderShell("welcome");

    expect(getSession).not.toHaveBeenCalled();
  });
});
