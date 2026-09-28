import {
  builtApp,
  needsPodInstall,
  parseArgs,
  pickDevice,
  readSigning,
  releaseUrlWarning,
  xcodebuildArgs,
} from "../ios-device";

describe("parseArgs", () => {
  it("returns Debug and no device by default", () => {
    expect(parseArgs([])).toEqual({ configuration: "Debug", device: undefined, help: false });
  });

  it("returns the configuration and device given as separate or joined values", () => {
    expect(parseArgs(["--configuration", "Release", "--device", "Daniel's iPhone pro"])).toEqual({
      configuration: "Release",
      device: "Daniel's iPhone pro",
      help: false,
    });
    expect(parseArgs(["--configuration=release", "--device=00008140-000951320CDB001C"])).toEqual({
      configuration: "Release",
      device: "00008140-000951320CDB001C",
      help: false,
    });
  });

  it("returns help for --help and -h", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  it("throws on an unknown configuration, a missing value or an unknown flag", () => {
    expect(() => parseArgs(["--configuration", "Profile"])).toThrow(/Debug or Release/);
    expect(() => parseArgs(["--device"])).toThrow(/--device needs a value/);
    expect(() => parseArgs(["--configuration", "--device", "x"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--simulator"])).toThrow(/unknown argument/);
  });
});

describe("readSigning", () => {
  it("returns the team id and bundle id from app.json", () => {
    const appJson = { expo: { ios: { appleTeamId: "7DD5F92WWS", bundleIdentifier: "com.a.b" } } };
    expect(readSigning(appJson)).toEqual({ teamId: "7DD5F92WWS", bundleId: "com.a.b" });
  });

  it("throws when either is missing", () => {
    expect(() => readSigning({ expo: { ios: { bundleIdentifier: "com.a.b" } } })).toThrow(
      /appleTeamId/
    );
    expect(() => readSigning({ expo: { ios: { appleTeamId: "7DD5F92WWS" } } })).toThrow(
      /bundleIdentifier/
    );
  });
});

const phone = {
  identifier: "F5FE7C9C-783B-5720-8862-88FFAD280C09",
  connectionProperties: { tunnelState: "connected" },
  deviceProperties: { name: "Daniel's iPhone pro" },
  hardwareProperties: {
    udid: "00008140-000951320CDB001C",
    platform: "iOS",
    reality: "physical",
    deviceType: "iPhone",
  },
};
const watch = {
  identifier: "F1F5CA78-C7A0-54B1-AFA7-3A97585F97CE",
  deviceProperties: { name: "Daniel – Apple Watch" },
  hardwareProperties: {
    udid: "00008301-C88D39482EA3402E",
    platform: "watchOS",
    reality: "physical",
    deviceType: "appleWatch",
  },
};
const simulator = {
  identifier: "04462EAA-3160-410F-B45A-CB3851D2261D",
  deviceProperties: { name: "iPhone 16 Pro" },
  hardwareProperties: {
    udid: "04462EAA-3160-410F-B45A-CB3851D2261D",
    platform: "iOS",
    reality: "simulated",
    deviceType: "iPhone",
  },
};
const secondPhone = {
  identifier: "0A0A0A0A-0000-0000-0000-000000000000",
  connectionProperties: { tunnelState: "connected" },
  deviceProperties: { name: "Test iPhone" },
  hardwareProperties: {
    udid: "00008110-000000000000001E",
    platform: "iOS",
    reality: "physical",
    deviceType: "iPhone",
  },
};

const offline = (device: typeof phone) => ({
  ...device,
  connectionProperties: { tunnelState: "disconnected" },
});

describe("pickDevice", () => {
  const expected = { udid: "00008140-000951320CDB001C", name: "Daniel's iPhone pro" };

  it("returns the only physical iOS device when no selector is given", () => {
    expect(pickDevice([watch, simulator, phone], undefined)).toEqual(expected);
  });

  it("returns the connected phone and skips paired phones that are offline", () => {
    expect(pickDevice([offline(secondPhone), phone], undefined)).toEqual(expected);
  });

  it("returns the device matching a udid, an identifier or a name, ignoring case", () => {
    const devices = [phone, secondPhone];
    expect(pickDevice(devices, "00008140-000951320CDB001C")).toEqual(expected);
    expect(pickDevice(devices, "F5FE7C9C-783B-5720-8862-88FFAD280C09")).toEqual(expected);
    expect(pickDevice(devices, "daniel's iphone pro")).toEqual(expected);
  });

  it("returns an offline phone when a selector names it", () => {
    expect(pickDevice([offline(phone)], "Daniel's iPhone pro")).toEqual(expected);
  });

  it("throws when several connected phones match no selector", () => {
    expect(() => pickDevice([phone, secondPhone], undefined)).toThrow(
      /several.*Daniel's iPhone pro.*Test iPhone/s
    );
  });

  it("throws, listing the paired phones, when none is connected", () => {
    expect(() => pickDevice([offline(phone), offline(secondPhone)], undefined)).toThrow(
      /none is connected.*unlock.*plug.*Daniel's iPhone pro.*Test iPhone/s
    );
  });

  it("throws when no phone is paired or none matches", () => {
    expect(() => pickDevice([watch, simulator], undefined)).toThrow(/no paired iPhone/);
    expect(() => pickDevice([phone], "iPhone 16 Pro")).toThrow(/no paired iPhone matches/);
  });
});

describe("needsPodInstall", () => {
  it("returns true when the Pods manifest is missing", () => {
    expect(needsPodInstall(null, 100)).toBe(true);
    expect(needsPodInstall(null, null)).toBe(true);
  });

  it("returns true when package-lock.json is newer than the Pods manifest", () => {
    expect(needsPodInstall(100, 200)).toBe(true);
  });

  it("returns false when the Pods manifest is as new as package-lock.json or newer", () => {
    expect(needsPodInstall(200, 200)).toBe(false);
    expect(needsPodInstall(300, 200)).toBe(false);
    expect(needsPodInstall(300, null)).toBe(false);
  });
});

describe("releaseUrlWarning", () => {
  it("returns null for a Debug build", () => {
    expect(releaseUrlWarning("Debug", undefined, [])).toBeNull();
  });

  it("returns null when the environment or an env file sets the URL", () => {
    expect(releaseUrlWarning("Release", "https://api.flexi-day.com", [])).toBeNull();
    expect(
      releaseUrlWarning("Release", undefined, [
        "# note\nEXPO_PUBLIC_API_URL=https://api.flexi-day.com\n",
      ])
    ).toBeNull();
    expect(
      releaseUrlWarning("Release", undefined, ["export EXPO_PUBLIC_API_URL = https://x.test"])
    ).toBeNull();
  });

  it("returns a warning naming localhost when no URL is set", () => {
    const warning = releaseUrlWarning("Release", "", [
      "# EXPO_PUBLIC_API_URL=https://api.flexi-day.com",
      "EXPO_PUBLIC_API_URL=",
      "EXPO_PUBLIC_WEB_URL=https://flexi-day.com",
    ]);
    expect(warning).toMatch(/http:\/\/localhost:8080/);
    expect(warning).toMatch(/Production build/);
  });
});

describe("xcodebuildArgs", () => {
  it("returns a device build that may create profiles and register the device", () => {
    expect(
      xcodebuildArgs({
        workspace: "ios/FlexiDay.xcworkspace",
        scheme: "FlexiDay",
        configuration: "Release",
        udid: "00008140-000951320CDB001C",
        teamId: "7DD5F92WWS",
        derivedDataPath: "ios/build",
      })
    ).toEqual([
      "-workspace",
      "ios/FlexiDay.xcworkspace",
      "-scheme",
      "FlexiDay",
      "-configuration",
      "Release",
      "-destination",
      "id=00008140-000951320CDB001C",
      "-derivedDataPath",
      "ios/build",
      "-allowProvisioningUpdates",
      "-allowProvisioningDeviceRegistration",
      "DEVELOPMENT_TEAM=7DD5F92WWS",
      "CODE_SIGN_STYLE=Automatic",
      "COCOAPODS_PARALLEL_CODE_SIGN=true",
      "COMPILER_INDEX_STORE_ENABLE=NO",
    ]);
  });
});

describe("builtApp", () => {
  it("returns the app bundle under the configuration's iphoneos products folder", () => {
    expect(builtApp("ios/build", "Debug", "FlexiDay")).toBe(
      "ios/build/Build/Products/Debug-iphoneos/FlexiDay.app"
    );
  });
});
