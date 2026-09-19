import { getNetworkStateAsync } from "expo-network";

import { deviceIsOnline } from "../network";

jest.mock("expo-network", () => ({ getNetworkStateAsync: jest.fn() }));

const networkState = getNetworkStateAsync as jest.MockedFunction<typeof getNetworkStateAsync>;

describe("deviceIsOnline", () => {
  it("returns true when the internet is reachable", async () => {
    networkState.mockResolvedValue({ isConnected: true, isInternetReachable: true });

    await expect(deviceIsOnline()).resolves.toBe(true);
  });

  it("returns false when the device has a connection that reaches nothing", async () => {
    networkState.mockResolvedValue({ isConnected: true, isInternetReachable: false });

    await expect(deviceIsOnline()).resolves.toBe(false);
  });

  it("returns false in airplane mode", async () => {
    networkState.mockResolvedValue({ isConnected: false });

    await expect(deviceIsOnline()).resolves.toBe(false);
  });

  it("returns true when the device reports no network state at all", async () => {
    networkState.mockResolvedValue({});

    await expect(deviceIsOnline()).resolves.toBe(true);
  });

  it("returns true when the network state cannot be read", async () => {
    networkState.mockRejectedValue(new Error("no network module"));

    await expect(deviceIsOnline()).resolves.toBe(true);
  });
});
