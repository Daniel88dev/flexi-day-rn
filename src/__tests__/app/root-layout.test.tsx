import { render, screen, waitFor } from "@testing-library/react-native";

import RootLayout from "@/app/_layout";
import { loadDeviceId } from "@/lib/session/device-id";

jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  return { Stack: () => React.createElement(Text, null, "app") };
});

jest.mock("@/lib/session/device-id", () => ({ loadDeviceId: jest.fn() }));

const readDeviceId = loadDeviceId as jest.MockedFunction<typeof loadDeviceId>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RootLayout", () => {
  it("renders nothing until the Device id is read", async () => {
    readDeviceId.mockReturnValue(new Promise(() => {}));

    await render(<RootLayout />);

    expect(screen.queryByText("app")).toBeNull();
  });

  it("renders the app once the Device id is read", async () => {
    readDeviceId.mockResolvedValue("a-device");

    await render(<RootLayout />);

    await waitFor(() => expect(screen.getByText("app")).toBeTruthy());
  });

  it("renders the app even when the Device id could not be read", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    readDeviceId.mockRejectedValue(new Error("The Keychain is locked."));

    await render(<RootLayout />);

    await waitFor(() => expect(screen.getByText("app")).toBeTruthy());
  });
});
