import * as SecureStore from "expo-secure-store";

import { keychain } from "@/lib/session/keychain";

jest.mock("expo-secure-store", () => ({
  getItem: jest.fn(),
  getItemAsync: jest.fn(),
  setItem: jest.fn(),
  setItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
}));

const thisDeviceOnly = { keychainAccessible: "whenUnlockedThisDeviceOnly" };

describe("keychain", () => {
  it("writes and reads every entry as this-device-only, so a backup restore carries none", async () => {
    keychain.setItem("flexi-day_cookie", "{}");
    await keychain.setItemAsync("flexi-day_device_id", "an-id");
    keychain.getItem("flexi-day_cookie");
    await keychain.getItemAsync("flexi-day_device_id");

    expect(SecureStore.setItem).toHaveBeenCalledWith("flexi-day_cookie", "{}", thisDeviceOnly);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "flexi-day_device_id",
      "an-id",
      thisDeviceOnly
    );
    expect(SecureStore.getItem).toHaveBeenCalledWith("flexi-day_cookie", thisDeviceOnly);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("flexi-day_device_id", thisDeviceOnly);
  });
});
