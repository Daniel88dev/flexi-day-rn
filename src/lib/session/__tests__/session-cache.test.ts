import * as SecureStore from "expo-secure-store";

import {
  SESSION_CACHE_KEY,
  loadCachedSession,
  parseCachedSession,
} from "@/lib/session/session-cache";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
}));

// The expo plugin's own storage wrapper only adds chunking and key normalisation over what the
// secure store holds, so the test hands the store through unchanged.
jest.mock("@better-auth/expo/client", () => ({
  storageAdapter: (storage: unknown) => storage,
  expoClient: jest.fn(() => ({ id: "expo" })),
}));

jest.mock("better-auth/react", () => ({ createAuthClient: () => ({ getCookie: jest.fn() }) }));

jest.mock("better-auth/client/plugins", () => ({
  twoFactorClient: jest.fn(() => ({ id: "two-factor" })),
}));

const NOW = Date.parse("2026-09-20T10:00:00.000Z");

function cacheEntry(expiresAt: string, userId = "R7kQ2mZx8pL4nD6vB1sT3wY5cA0gH9jF"): string {
  return JSON.stringify({
    user: { id: userId, name: "Dana Holt", email: "dana@northwind.co" },
    session: { id: "session-1", expiresAt },
  });
}

describe("parseCachedSession", () => {
  it("returns the cached session when it has not expired yet", () => {
    expect(parseCachedSession(cacheEntry("2026-10-20T10:00:00.000Z"), NOW)).toEqual({
      userId: "R7kQ2mZx8pL4nD6vB1sT3wY5cA0gH9jF",
    });
  });

  it("returns none when the phone has never cached a session", () => {
    expect(parseCachedSession(null, NOW)).toBeNull();
  });

  it("returns none when the cache was emptied", () => {
    expect(parseCachedSession("{}", NOW)).toBeNull();
  });

  it("returns none when the cached session has expired", () => {
    expect(parseCachedSession(cacheEntry("2026-09-19T10:00:00.000Z"), NOW)).toBeNull();
  });

  it("returns none when the cached entry names no user", () => {
    const raw = JSON.stringify({ session: { id: "session-1", expiresAt: "2026-10-20T10:00:00Z" } });

    expect(parseCachedSession(raw, NOW)).toBeNull();
  });

  it("returns none when the cached entry names no session", () => {
    const raw = JSON.stringify({ user: { id: "a-user" } });

    expect(parseCachedSession(raw, NOW)).toBeNull();
  });

  it("returns none when the stored value is not the cache's shape", () => {
    expect(parseCachedSession("not json", NOW)).toBeNull();
  });
});

describe("loadCachedSession", () => {
  const getItemAsync = SecureStore.getItemAsync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the session the expo client cached in the Keychain", async () => {
    getItemAsync.mockResolvedValue(cacheEntry("2036-01-01T00:00:00.000Z", "a-user"));

    await expect(loadCachedSession()).resolves.toEqual({ userId: "a-user" });
    expect(getItemAsync).toHaveBeenCalledWith(SESSION_CACHE_KEY, expect.anything());
  });

  it("returns no session when the Keychain refuses to answer", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    getItemAsync.mockRejectedValue(new Error("The Keychain is locked."));

    await expect(loadCachedSession()).resolves.toBeNull();
  });
});
