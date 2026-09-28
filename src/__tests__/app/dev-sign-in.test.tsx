import { render, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import DevSignInRoute from "@/app/dev-sign-in";
import { destroyStore } from "@/lib/local-store";
import { queryClient } from "@/lib/query/runtime";
import { authClient } from "@/lib/session/auth-client";
import { takeDevSignInLanding } from "@/lib/session/dev-sign-in";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider, useRootRoute } from "@/lib/session/root-route-context";
import { clearSignedOutNotice, signedOutNoticeShowing } from "@/lib/session/signed-out-notice";
import { VIEWER } from "@/test-support/session";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockNavigation = { getState: jest.fn(), reset: jest.fn() };

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
  useNavigation: () => mockNavigation,
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/session/auth-client", () => ({
  STORAGE_PREFIX: "flexi-day",
  SESSION_COOKIE_KEY: "flexi-day_cookie",
  clearClientSession: jest.fn(),
  authClient: { $fetch: jest.fn(), getSession: jest.fn() },
}));

jest.mock("expo-secure-store", () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }));

jest.mock("@better-auth/expo/client", () => ({ storageAdapter: (storage: unknown) => storage }));

jest.mock("@/lib/local-store", () => ({ destroyStore: jest.fn().mockResolvedValue(undefined) }));

jest.mock("@/lib/reminders/device", () => ({
  clearClockReminders: jest.fn().mockResolvedValue(undefined),
}));

/** `__DEV__` is a bundler global, so a test flips it through the object it lives on. */
const runtimeGlobals = globalThis as unknown as { __DEV__: boolean };

const params = useLocalSearchParams as jest.Mock;
const redeem = authClient.$fetch as unknown as jest.Mock;
const getSession = authClient.getSession as unknown as jest.Mock;
const destroy = destroyStore as jest.MockedFunction<typeof destroyStore>;
const replace = router.replace as jest.Mock;

const SHELL = { key: "app-1", name: "(app)" };
const HERE = { key: "dev-sign-in-1", name: "dev-sign-in" };

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  clearSignedOutNotice();
  takeDevSignInLanding();
  params.mockReturnValue({ ticket: "a-ticket", to: "/requests" });
  redeem.mockResolvedValue({ data: { token: "a-token", user: VIEWER }, error: null });
  getSession.mockResolvedValue({ data: { user: VIEWER }, error: null });
  mockNavigation.getState.mockReturnValue({ key: "root", index: 1, routes: [SHELL, HERE] });
});

afterEach(() => queryClient.clear());

function RouteProbe() {
  return <Text testID="root-route">{useRootRoute()}</Text>;
}

function routeUnder(route: RootRoute) {
  return (
    <RootRouteProvider route={route}>
      <DevSignInRoute />
      <RouteProbe />
    </RootRouteProvider>
  );
}

function renderRoute(route: RootRoute = "signed-in") {
  return render(routeUnder(route));
}

const rootRoute = () => screen.getByTestId("root-route").props.children as RootRoute;

describe("DevSignInRoute", () => {
  it("wipes the phone before it redeems the ticket, without going to welcome", async () => {
    await renderRoute();

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.invocationCallOrder[0]).toBeLessThan(redeem.mock.invocationCallOrder[0]);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(signedOutNoticeShowing()).toBe(false);
  });

  it("drops the screens below it before the wipe, so no signed-in shell outlives the store", async () => {
    await renderRoute();

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(mockNavigation.reset).toHaveBeenCalledWith({ key: "root", index: 0, routes: [HERE] });
    expect(mockNavigation.reset.mock.invocationCallOrder[0]).toBeLessThan(
      destroy.mock.invocationCallOrder[0]
    );
  });

  it("leaves a stack that is only this screen alone", async () => {
    mockNavigation.getState.mockReturnValue({ key: "root", index: 0, routes: [HERE] });

    await renderRoute();

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it("redeems the ticket through the auth client and reads the session back", async () => {
    await renderRoute();

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(redeem).toHaveBeenCalledWith("/dev/redeem-sign-in-ticket", {
      method: "POST",
      body: { ticket: "a-ticket" },
    });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(rootRoute()).toBe("signed-in");
  });

  it("lands on the shell and leaves the path the link names for it to open", async () => {
    await renderRoute("welcome");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(takeDevSignInLanding()).toBe("/requests");
    expect(rootRoute()).toBe("signed-in");
  });

  it("lands on the dashboard when the link names no path", async () => {
    params.mockReturnValue({ ticket: "a-ticket" });

    await renderRoute("welcome");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(takeDevSignInLanding()).toBeNull();
  });

  it.each(["https://example.com", "flexiday://requests", "//example.com/requests", "requests"])(
    "lands on the dashboard when the path is %s",
    async (to) => {
      params.mockReturnValue({ ticket: "a-ticket", to });

      await renderRoute("welcome");

      await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
      expect(takeDevSignInLanding()).toBeNull();
    }
  );

  it("shows a busy state while the ticket is redeemed", async () => {
    redeem.mockReturnValue(new Promise(() => {}));

    await renderRoute();

    expect(screen.getByTestId("dev-sign-in-busy")).toBeTruthy();
    expect(screen.queryByTestId("dev-sign-in-error")).toBeNull();
  });

  it("shows the refusal under dev-sign-in-error and stays signed out", async () => {
    redeem.mockResolvedValue({
      data: null,
      error: { status: 401, code: "INVALID_SIGN_IN_TICKET", message: "Invalid sign-in ticket" },
    });

    await renderRoute();

    expect(await screen.findByTestId("dev-sign-in-error")).toHaveTextContent(
      "INVALID_SIGN_IN_TICKET: Invalid sign-in ticket"
    );
    expect(rootRoute()).toBe("welcome");
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(takeDevSignInLanding()).toBeNull();
    expect(screen.queryByTestId("dev-sign-in-busy")).toBeNull();
  });

  it("redeems a new link opened over a failed one on the same screen", async () => {
    redeem.mockResolvedValueOnce({ data: null, error: { status: 401, message: "Spent" } });
    const view = await renderRoute();
    expect(await screen.findByTestId("dev-sign-in-error")).toHaveTextContent("Spent");

    params.mockReturnValue({ ticket: "another-ticket", to: "/settings" });
    await view.rerender(routeUnder("signed-in"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(takeDevSignInLanding()).toBe("/settings");
    expect(redeem).toHaveBeenLastCalledWith("/dev/redeem-sign-in-ticket", {
      method: "POST",
      body: { ticket: "another-ticket" },
    });
  });

  it("shows why when the link carries no ticket, and leaves the phone alone", async () => {
    params.mockReturnValue({});

    await renderRoute();

    expect(await screen.findByTestId("dev-sign-in-error")).toHaveTextContent(/no ticket/);
    expect(destroy).not.toHaveBeenCalled();
    expect(redeem).not.toHaveBeenCalled();
  });

  it("redirects home outside a development build and makes no request", async () => {
    const development = runtimeGlobals.__DEV__;
    runtimeGlobals.__DEV__ = false;

    try {
      await renderRoute();

      expect(screen.getByText("/")).toBeTruthy();
      expect(redeem).not.toHaveBeenCalled();
      expect(getSession).not.toHaveBeenCalled();
      expect(destroy).not.toHaveBeenCalled();
      expect(rootRoute()).toBe("signed-in");
    } finally {
      runtimeGlobals.__DEV__ = development;
    }
  });
});
