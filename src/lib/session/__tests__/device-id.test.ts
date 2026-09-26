import * as SecureStore from "expo-secure-store";

import {
  DEVICE_ID_KEY,
  currentDeviceId,
  loadDeviceId,
  readOrMintDeviceId,
  type DeviceIdStorage,
} from "@/lib/session/device-id";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
}));

jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));

function fakeSecureStore(stored: Record<string, string> = {}): DeviceIdStorage {
  const items = new Map(Object.entries(stored));
  return {
    getItemAsync: async (key) => items.get(key) ?? null,
    setItemAsync: async (key, value) => {
      items.set(key, value);
    },
  };
}

/** Every call answers a different id, so a second mint is visible in the result. */
function countingMint(): () => string {
  let minted = 0;
  return () => `device-${++minted}`;
}

describe("readOrMintDeviceId", () => {
  it("returns a newly minted Device id when the secure store holds none", async () => {
    const storage = fakeSecureStore();

    await expect(readOrMintDeviceId(storage, countingMint())).resolves.toBe("device-1");
  });

  it("returns the same Device id on a second read", async () => {
    const storage = fakeSecureStore();
    const mint = countingMint();

    const first = await readOrMintDeviceId(storage, mint);
    const second = await readOrMintDeviceId(storage, mint);

    expect(second).toBe(first);
  });

  it("returns the id already stored under the Device id key", async () => {
    const storage = fakeSecureStore({ [DEVICE_ID_KEY]: "minted-on-an-earlier-launch" });

    await expect(readOrMintDeviceId(storage, countingMint())).resolves.toBe(
      "minted-on-an-earlier-launch"
    );
  });

  it("returns an id it wrote under the Device id key, so a later launch finds it", async () => {
    const storage = fakeSecureStore();

    const minted = await readOrMintDeviceId(storage, countingMint());

    await expect(storage.getItemAsync(DEVICE_ID_KEY)).resolves.toBe(minted);
  });
});

describe("loadDeviceId", () => {
  const getItemAsync = SecureStore.getItemAsync as jest.Mock;
  const setItemAsync = SecureStore.setItemAsync as jest.Mock;
  const randomUUID = jest.requireMock("expo-crypto").randomUUID as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The Device id is read once per launch, so these run in order: unread first, loaded after.
  it("returns null from currentDeviceId until the Device id is loaded", () => {
    expect(currentDeviceId()).toBeNull();
  });

  it("returns no Device id when the Keychain refuses to answer", async () => {
    getItemAsync.mockRejectedValue(new Error("The Keychain is locked."));

    await expect(loadDeviceId()).rejects.toThrow("The Keychain is locked.");
    expect(currentDeviceId()).toBeNull();
  });

  it("returns the Device id it minted and keeps answering it without reading the store again", async () => {
    getItemAsync.mockResolvedValue(null);
    randomUUID.mockReturnValue("a-fresh-uuid");

    await expect(loadDeviceId()).resolves.toBe("a-fresh-uuid");
    expect(setItemAsync).toHaveBeenCalledWith(DEVICE_ID_KEY, "a-fresh-uuid", {
      keychainAccessible: "whenUnlockedThisDeviceOnly",
    });
    expect(currentDeviceId()).toBe("a-fresh-uuid");

    getItemAsync.mockClear();
    await expect(loadDeviceId()).resolves.toBe("a-fresh-uuid");
    expect(getItemAsync).not.toHaveBeenCalled();
  });
});
