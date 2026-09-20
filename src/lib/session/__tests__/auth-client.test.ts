import { sessionCookie } from "@/lib/session/auth-client";
import { loadDeviceId } from "@/lib/session/device-id";

type RequestHook = (context: { headers: { set(name: string, value: string): void } }) => unknown;

type AuthClientMock = {
  clientOptions: { fetchOptions: { onRequest: RequestHook } }[];
  getCookie: jest.Mock<Promise<string>, []>;
};

// The module under test builds its client at import time, which runs before any `const` in this
// file, so the mock owns what it records.
jest.mock("better-auth/react", () => {
  const clientOptions: unknown[] = [];
  const getCookie = jest.fn();
  return {
    createAuthClient: (options: unknown) => {
      clientOptions.push(options);
      return { getCookie };
    },
    clientOptions,
    getCookie,
  };
});

jest.mock("@better-auth/expo/client", () => ({ expoClient: jest.fn(() => ({ id: "expo" })) }));

jest.mock("better-auth/client/plugins", () => ({
  twoFactorClient: jest.fn(() => ({ id: "two-factor" })),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  WHEN_UNLOCKED: "whenUnlocked",
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "3f2c1b6a-4d5e-4f70-8a91-2b3c4d5e6f70"),
}));

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "1.4.0",
  nativeBuildVersion: "12",
}));

const authReact = jest.requireMock<AuthClientMock>("better-auth/react");

describe("authClient", () => {
  it("returns a request carrying the four client headers from its request hook", async () => {
    await loadDeviceId();
    const sent = new Map<string, string>();

    authReact.clientOptions[0].fetchOptions.onRequest({
      headers: { set: (name, value) => void sent.set(name, value) },
    });

    expect(Object.fromEntries(sent)).toEqual({
      "x-client-device-id": "3f2c1b6a-4d5e-4f70-8a91-2b3c4d5e6f70",
      "x-client-session-id": "3f2c1b6a-4d5e-4f70-8a91-2b3c4d5e6f70",
      "x-client-platform": "ios",
      "x-client-app-version": "1.4.0+12",
    });
  });
});

describe("sessionCookie", () => {
  it("returns what the auth client's cookie jar holds", async () => {
    authReact.getCookie.mockResolvedValue("flexi-day.session_token=abc");

    await expect(sessionCookie()).resolves.toBe("flexi-day.session_token=abc");
  });

  it("returns an empty string while nobody is signed in", async () => {
    authReact.getCookie.mockResolvedValue("");

    await expect(sessionCookie()).resolves.toBe("");
  });
});
