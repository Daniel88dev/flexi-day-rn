import * as Location from "expo-location";
import { AppState, type AppStateStatus } from "react-native";

import { onLeavingApp, phoneLocation } from "../location-device";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, Highest: 5 },
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const mocked = jest.mocked(Location);
const at = (accuracy: number | null) =>
  ({ coords: { latitude: 50.1, longitude: 14.4, accuracy }, timestamp: 0 }) as never;

describe("phoneLocation", () => {
  it("returns a reduced grant when Precise Location is off", async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      ios: { accuracy: "reduced", scope: "whenInUse" },
    } as never);
    await expect(phoneLocation.requestPermission()).resolves.toEqual({
      granted: true,
      reduced: true,
    });
  });

  it("returns a full grant as not reduced", async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      ios: { accuracy: "full", scope: "whenInUse" },
    } as never);
    await expect(phoneLocation.requestPermission()).resolves.toEqual({
      granted: true,
      reduced: false,
    });
  });

  it("returns the last known position no older than it was asked for", async () => {
    mocked.getLastKnownPositionAsync.mockResolvedValue(at(40));
    await expect(phoneLocation.lastKnown(60_000)).resolves.toEqual({
      latitude: 50.1,
      longitude: 14.4,
      accuracy: 40,
    });
    expect(mocked.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 60_000 });
  });

  it("returns null when there is no recent position", async () => {
    mocked.getLastKnownPositionAsync.mockResolvedValue(null);
    await expect(phoneLocation.lastKnown(60_000)).resolves.toBeNull();
  });

  it("reads a new position at the accuracy asked for", async () => {
    mocked.getCurrentPositionAsync.mockResolvedValue(at(5));
    await phoneLocation.current("highest");
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 5 });
  });
});

describe("onLeavingApp", () => {
  it("calls back on the background, not on inactive", () => {
    let change: (state: AppStateStatus) => void = () => undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_, handler) => {
      change = handler as typeof change;
      return { remove };
    });
    const listener = jest.fn();

    const unsubscribe = onLeavingApp(listener);
    change("inactive");
    expect(listener).not.toHaveBeenCalled();
    change("background");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(remove).toHaveBeenCalled();
  });
});
