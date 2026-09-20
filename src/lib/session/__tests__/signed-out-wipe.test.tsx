import { act, renderHook } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ReactNode } from "react";

import { destroyStore } from "@/lib/local-store";
import { SESSION_COOKIE_KEY } from "@/lib/session/auth-client";
import { DEVICE_ID_KEY } from "@/lib/session/device-id";
import { RootRouteProvider, useRootRoute } from "@/lib/session/root-route-context";
import { SESSION_CACHE_KEY } from "@/lib/session/session-cache";
import { signedOutNoticeShowing, clearSignedOutNotice } from "@/lib/session/signed-out-notice";
import { signedOutWipe, useSignedOutWipe } from "@/lib/session/signed-out-wipe";
import { createFakeKeychain, type FakeKeychain } from "@/test-support/fake-keychain";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

jest.mock("@better-auth/expo/client", () => ({
  storageAdapter: (storage: unknown) => storage,
  expoClient: jest.fn(() => ({ id: "expo" })),
}));

// The client's own session atom, which the wipe has to drop along with the Keychain entries.
const sessionAtom = { value: { data: { user: { id: "kXk2Q7pR9sT1vW3yZ5aB7cD9eF1gH3iJ" } } } };

jest.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    getCookie: jest.fn(),
    $store: {
      atoms: {
        session: {
          get: () => sessionAtom.value,
          set: (next: unknown) => {
            sessionAtom.value = next as typeof sessionAtom.value;
          },
        },
      },
    },
  }),
}));

jest.mock("better-auth/client/plugins", () => ({
  twoFactorClient: jest.fn(() => ({ id: "two-factor" })),
}));

jest.mock("@/lib/local-store", () => ({ destroyStore: jest.fn().mockResolvedValue(undefined) }));

const DEVICE_ID = "3f0c1d2e-9a7b-4c5d-8e6f-1a2b3c4d5e6f";
const replace = router.replace as jest.Mock;

let keychain: FakeKeychain;
let destroyLocalStore: jest.Mock;
let clearSession: jest.Mock;
let setRootRoute: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clearSignedOutNotice();
  keychain = createFakeKeychain({
    [DEVICE_ID_KEY]: DEVICE_ID,
    [SESSION_COOKIE_KEY]: "flexi-day.session_token=abc; Max-Age=315360000",
    [SESSION_CACHE_KEY]: '{"user":{"id":"kXk2Q7pR9sT1vW3yZ5aB7cD9eF1gH3iJ"}}',
  });
  destroyLocalStore = jest.fn().mockResolvedValue(undefined);
  clearSession = jest.fn();
  setRootRoute = jest.fn();
  sessionAtom.value = { data: { user: { id: "kXk2Q7pR9sT1vW3yZ5aB7cD9eF1gH3iJ" } } };
});

function wipe(overrides: Record<string, unknown> = {}) {
  return signedOutWipe({
    storage: keychain,
    destroyLocalStore,
    clearSession,
    setRootRoute,
    ...overrides,
  });
}

describe("signedOutWipe", () => {
  it("empties the cookie jar and the session cache the expo plugin keeps", async () => {
    await wipe();

    expect(keychain.entries()[SESSION_COOKIE_KEY]).toBe("{}");
    expect(keychain.entries()[SESSION_CACHE_KEY]).toBe("{}");
  });

  it("keeps the Device id, which outlives the session it signed out of", async () => {
    await wipe();

    expect(keychain.entries()[DEVICE_ID_KEY]).toBe(DEVICE_ID);
  });

  it("destroys the Local store, so no row of the signed-out user stays on the phone", async () => {
    await wipe();

    expect(destroyLocalStore).toHaveBeenCalledTimes(1);
  });

  it("drops the session the auth client still holds, so no screen greets the old viewer", async () => {
    await wipe();

    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("sets the welcome notice, the only trace the wipe leaves", async () => {
    await wipe();

    expect(signedOutNoticeShowing()).toBe(true);
  });

  it("moves the root route to welcome and replaces to it", async () => {
    await wipe();

    expect(setRootRoute).toHaveBeenCalledWith("welcome");
    expect(replace).toHaveBeenCalledWith("/welcome");
  });

  it("leaves the same phone behind when it runs twice", async () => {
    await wipe();
    const afterFirst = keychain.entries();

    await wipe();

    expect(keychain.entries()).toEqual(afterFirst);
    expect(signedOutNoticeShowing()).toBe(true);
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it("runs once when a 401 and the session lookup answer at the same time", async () => {
    await Promise.all([wipe(), wipe()]);

    expect(destroyLocalStore).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("runs again for a later sign-out, once the first wipe is over", async () => {
    await Promise.all([wipe(), wipe()]);

    await wipe();

    expect(destroyLocalStore).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it("lands on welcome even when the Keychain refuses to answer", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const refusing = { setItemAsync: jest.fn().mockRejectedValue(new Error("keychain locked")) };

    await wipe({ storage: refusing });

    expect(destroyLocalStore).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/welcome");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("lands on welcome even when the Local store will not close", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    destroyLocalStore.mockRejectedValue(new Error("database busy"));

    await wipe();

    expect(keychain.entries()[SESSION_COOKIE_KEY]).toBe("{}");
    expect(replace).toHaveBeenCalledWith("/welcome");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

function wrapper({ children }: { children: ReactNode }) {
  return <RootRouteProvider route="signed-in">{children}</RootRouteProvider>;
}

describe("useSignedOutWipe", () => {
  it("wipes the phone and moves the root route the guards read", async () => {
    const { result } = await renderHook(
      () => ({ wipe: useSignedOutWipe(), route: useRootRoute() }),
      { wrapper }
    );

    await act(async () => {
      await result.current.wipe();
    });

    expect(destroyStore).toHaveBeenCalledTimes(1);
    expect(sessionAtom.value).toMatchObject({ data: null });
    expect(result.current.route).toBe("welcome");
    expect(replace).toHaveBeenCalledWith("/welcome");
  });
});
