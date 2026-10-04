import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert } from "react-native";

import AppLayout from "@/app/(app)/_layout";
import { destroyStore, openStore } from "@/lib/local-store";
import { apiRequest, queryClient } from "@/lib/query";
import type { FakeAppState } from "@/test-support/fake-app-state";
import { authClient } from "@/lib/session/auth-client";
import { setDevSignInLanding, takeDevSignInLanding } from "@/lib/session/dev-sign-in";
import { clearHeldInvite, holdInvite, takeHeldInvite } from "@/lib/session/held-invite";
import { clearSignedOutNotice, signedOutNoticeShowing } from "@/lib/session/signed-out-notice";
import { attendance, session } from "@/test-support/attendance";
import { SESSION, VIEWER } from "@/test-support/session";
import { TranslationProvider } from "@/i18n/use-translation";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import type { RootRoute } from "@/lib/session/root-route";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

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

jest.mock("sonner-native", () => {
  const { View } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  return { Toaster: () => React.createElement(View, { testID: "toaster" }) };
});

// Its own test covers what it does; here it only has to mount once the store is open.
jest.mock("@/components/reminders/clock-reminders", () => {
  const { View } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  return { ClockReminders: () => React.createElement(View, { testID: "clock-reminders" }) };
});

jest.mock("expo-network", () => ({
  addNetworkStateListener: () => ({ remove: () => undefined }),
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));

jest.mock("@/lib/session/auth-client", () => ({
  SESSION_COOKIE_KEY: "flexi-day_cookie",
  clearClientSession: jest.fn(),
  sessionCookie: async () => "",
  authClient: {
    useSession: jest.fn(),
    getSession: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock("expo-secure-store", () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }));

jest.mock("@better-auth/expo/client", () => ({ storageAdapter: (storage: unknown) => storage }));

jest.mock("react-native-gesture-handler", () => {
  const { View } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: "gesture-root" }, children),
  };
});

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

// The shell and the sheet share the app's one query client; its garbage collection timers
// would outlive the test.
afterEach(() => queryClient.clear());

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
  // The clock disc reads /current as the shell mounts; a phone with no Employment keeps it quiet.
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ status: 404, json: async () => ({}) });
  clearSignedOutNotice();
  clearHeldInvite();
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

  it("leaves the gesture handler root and the Toaster to the root layout", async () => {
    await renderShell("signed-in");

    expect(await screen.findByTestId("clock-reminders")).toBeTruthy();
    expect(screen.queryByTestId("gesture-root")).toBeNull();
    expect(screen.queryByTestId("toaster")).toBeNull();
  });

  it("mounts the Clock reminders once the Local store is open", async () => {
    await renderShell("signed-in");

    expect(await screen.findByTestId("clock-reminders")).toBeTruthy();
  });

  it("gives every tab bar button a testID named after its link", async () => {
    await renderShell("signed-in");

    await waitFor(() => expect(screen.getByTestId("tab-report")).toBeTruthy());
    expect(screen.getByTestId("tab-dashboard")).toHaveTextContent("Dashboard");
    expect(screen.getByTestId("tab-requests")).toHaveTextContent("Requests");
    expect(screen.getByTestId("tab-more")).toHaveTextContent("More");
  });

  it("opens the More sheet from tab-more", async () => {
    await renderShell("signed-in");

    await act(async () => fireEvent.press(screen.getByTestId("tab-more")));

    expect(await screen.findByTestId("more-settings")).toBeTruthy();
  });

  it("opens a dev sign-in's landing once the Local store is open", async () => {
    setDevSignInLanding("/settings");

    await renderShell("signed-in");

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings"));
    expect(takeDevSignInLanding()).toBeNull();
  });

  it("puts the held invite's Join screen over the shell once the Local store is open", async () => {
    let storeOpened: () => void = () => undefined;
    open.mockReturnValueOnce(new Promise((resolve) => (storeOpened = () => resolve(undefined))));
    holdInvite({ token: "dev-alice-support-00000000000000000", invitedEmail: "alice@dev.local" });

    await renderShell("signed-in");

    expect(router.push).not.toHaveBeenCalled();

    await act(async () => storeOpened());

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/join",
        params: { token: "dev-alice-support-00000000000000000" },
      })
    );
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(takeHeldInvite()).toBeNull();
  });

  it("opens a dev sign-in's landing before a held invite, which stays held", async () => {
    const invite = {
      token: "dev-alice-support-00000000000000000",
      invitedEmail: "alice@dev.local",
    };
    setDevSignInLanding("/settings");
    holdInvite(invite);

    await renderShell("signed-in");

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(takeHeldInvite()).toEqual(invite);
  });

  it("opens nothing over the shell when nothing is held", async () => {
    await renderShell("signed-in");

    await waitFor(() => expect(open).toHaveBeenCalled());
    await act(async () => undefined);

    expect(router.push).not.toHaveBeenCalled();
  });

  it("leaves a held invite alone for a visitor sent to welcome", async () => {
    const invite = {
      token: "dev-alice-support-00000000000000000",
      invitedEmail: "alice@dev.local",
    };
    holdInvite(invite);

    await renderShell("welcome");

    expect(router.push).not.toHaveBeenCalled();
    expect(takeHeldInvite()).toEqual(invite);
  });

  it("opens the Clock sheet from the centre disc", async () => {
    mockFetch.mockResolvedValue({ status: 200, json: async () => attendance() });
    await renderShell("signed-in");

    await act(async () => fireEvent.press(await screen.findByTestId("clock-disc")));

    expect(router.push).toHaveBeenCalledWith("/clock");
  });
});

describe("AppLayout, the My attendance link", () => {
  const answer = (body: unknown) =>
    mockFetch.mockResolvedValue({ status: 200, json: async () => body });
  const barLabels = () =>
    screen.getAllByRole("tab").map((tab) => within(tab).queryByText(/./)?.props.children);

  it("puts My attendance on the bar while attendance is active", async () => {
    answer(attendance({ active: true }));
    await renderShell("signed-in");

    await waitFor(() => expect(barLabels()).toContain("My attendance"));
    expect(barLabels()).not.toContain("Report");
  });

  it("keeps it for a lapsed organization while a session is still open", async () => {
    answer(attendance({ active: false, openSession: session() }));
    await renderShell("signed-in");

    await waitFor(() => expect(barLabels()).toContain("My attendance"));
  });

  it("puts Report in its place for a lapsed organization with nothing open", async () => {
    answer(attendance({ active: false }));
    await renderShell("signed-in");

    await waitFor(() => expect(barLabels()).toContain("Report"));
    expect(barLabels()).not.toContain("My attendance");
  });

  it("puts Report in its place without an Employment, and moves Report off the More sheet", async () => {
    await renderShell("signed-in");

    await waitFor(() => expect(barLabels()).toContain("Report"));
    await act(async () => fireEvent.press(screen.getByText("More")));
    expect(screen.getAllByText("Report")).toHaveLength(1);
    expect(screen.queryByText("My attendance")).toBeNull();
  });
});

describe("AppLayout, signing the phone out", () => {
  it("wipes the phone when a request comes back unauthorized", async () => {
    await renderShell("signed-in");

    await answerUnauthorized();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(signedOutNoticeShowing()).toBe(true);
  });

  it("wipes the phone when a query layer request comes back unauthorized", async () => {
    await renderShell("signed-in");
    mockFetch.mockResolvedValue({ status: 401, json: async () => ({}) });

    await act(async () => {
      await apiRequest("/api/attendance/current").catch(() => undefined);
    });

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
