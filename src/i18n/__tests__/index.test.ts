import { deviceUses24HourClock } from "@/i18n";

let mockUses24: boolean | null = true;
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
  getCalendars: () => [{ uses24hourClock: mockUses24 }],
}));

describe("deviceUses24HourClock", () => {
  it("returns the device's setting", () => {
    mockUses24 = true;
    expect(deviceUses24HourClock()).toBe(true);
    mockUses24 = false;
    expect(deviceUses24HourClock()).toBe(false);
  });

  it("returns true when the device cannot tell", () => {
    mockUses24 = null;
    expect(deviceUses24HourClock()).toBe(true);
  });
});
