import { render, screen, waitFor } from "@testing-library/react-native";

import RootLayout from "@/app/_layout";
import { loadDeviceId } from "@/lib/session/device-id";
import { loadCachedSession } from "@/lib/session/session-cache";

// The Stack stands in for everything below the root layout and says which route it was given,
// so the test reads the decision the layout handed the rest of the app.
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  const { useRootRoute } = jest.requireActual("@/lib/session/root-route-context");
  const Stack = () => React.createElement(Text, null, `app:${useRootRoute()}`);
  return { Stack };
});

jest.mock("@/lib/session/device-id", () => ({ loadDeviceId: jest.fn() }));

jest.mock("@/lib/session/session-cache", () => ({ loadCachedSession: jest.fn() }));

const readDeviceId = loadDeviceId as jest.MockedFunction<typeof loadDeviceId>;
const readSessionCache = loadCachedSession as jest.MockedFunction<typeof loadCachedSession>;

function app(): string | null {
  return screen.queryByText(/^app:/)?.props.children ?? null;
}

beforeEach(() => {
  jest.clearAllMocks();
  readDeviceId.mockResolvedValue("a-device");
  readSessionCache.mockResolvedValue(null);
});

describe("RootLayout", () => {
  it("renders nothing until the Device id is read", async () => {
    readDeviceId.mockReturnValue(new Promise(() => {}));

    await render(<RootLayout />);

    expect(app()).toBeNull();
  });

  it("renders nothing until the cached session is read", async () => {
    readSessionCache.mockReturnValue(new Promise(() => {}));

    await render(<RootLayout />);

    expect(app()).toBeNull();
  });

  it("renders the app on welcome once both reads say nobody is signed in", async () => {
    await render(<RootLayout />);

    await waitFor(() => expect(app()).toBe("app:welcome"));
  });

  it("renders the app signed in for a phone with a cached session", async () => {
    readSessionCache.mockResolvedValue({ userId: "a-user" });

    await render(<RootLayout />);

    await waitFor(() => expect(app()).toBe("app:signed-in"));
  });

  it("renders the app even when the Device id could not be read", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    readDeviceId.mockRejectedValue(new Error("The Keychain is locked."));

    await render(<RootLayout />);

    await waitFor(() => expect(app()).toBe("app:welcome"));
  });
});
