import {
  attachClientHeaders,
  clientAppVersion,
  clientHeaders,
  currentClientHeaders,
} from "@/lib/session/client-headers";
import { currentDeviceId } from "@/lib/session/device-id";

jest.mock("@/lib/session/device-id", () => ({ currentDeviceId: jest.fn() }));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "9c8d7e6f-1a2b-4c3d-8e9f-0a1b2c3d4e5f"),
}));

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "1.4.0",
  nativeBuildVersion: "12",
}));

const loadedDeviceId = currentDeviceId as jest.MockedFunction<typeof currentDeviceId>;

const HEADERS_OF_THIS_PHONE = {
  "x-client-device-id": "a-device",
  "x-client-session-id": "9c8d7e6f-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  "x-client-platform": "ios",
  "x-client-app-version": "1.4.0+12",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("clientAppVersion", () => {
  it("returns the version and the build joined by a plus", () => {
    expect(clientAppVersion("1.4.0", "12")).toBe("1.4.0+12");
  });

  it("returns the version alone when the build number is unknown", () => {
    expect(clientAppVersion("1.4.0", null)).toBe("1.4.0");
  });

  it("returns null when neither is known", () => {
    expect(clientAppVersion(null, null)).toBeNull();
  });
});

describe("clientHeaders", () => {
  it("returns the four headers the backend reads", () => {
    expect(
      clientHeaders({
        deviceId: "a-device",
        sessionId: "a-launch",
        platform: "ios",
        appVersion: "1.4.0+12",
      })
    ).toEqual({
      "x-client-device-id": "a-device",
      "x-client-session-id": "a-launch",
      "x-client-platform": "ios",
      "x-client-app-version": "1.4.0+12",
    });
  });

  it("returns no app version header when the app version is unknown", () => {
    const headers = clientHeaders({
      deviceId: "a-device",
      sessionId: "a-launch",
      platform: "ios",
      appVersion: null,
    });

    expect(headers).not.toHaveProperty("x-client-app-version");
  });
});

describe("currentClientHeaders", () => {
  it("returns the four headers once the Device id is loaded", () => {
    loadedDeviceId.mockReturnValue("a-device");

    expect(currentClientHeaders()).toEqual(HEADERS_OF_THIS_PHONE);
  });

  it("returns the same session id on a second call within the launch", () => {
    loadedDeviceId.mockReturnValue("a-device");

    const first = currentClientHeaders()["x-client-session-id"];

    expect(currentClientHeaders()["x-client-session-id"]).toBe(first);
  });

  it("returns no headers before the Device id is loaded", () => {
    loadedDeviceId.mockReturnValue(null);

    expect(currentClientHeaders()).toEqual({});
  });
});

describe("attachClientHeaders", () => {
  it("sets every client header on the request it is given", () => {
    loadedDeviceId.mockReturnValue("a-device");
    const sent = new Map<string, string>();

    attachClientHeaders({ set: (name, value) => void sent.set(name, value) });

    expect(Object.fromEntries(sent)).toEqual(HEADERS_OF_THIS_PHONE);
  });

  it("sets no header before the Device id is loaded", () => {
    loadedDeviceId.mockReturnValue(null);
    const set = jest.fn();

    attachClientHeaders({ set });

    expect(set).not.toHaveBeenCalled();
  });
});
