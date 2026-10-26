import { act, render, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { PrivacyCover } from "@/components/privacy-cover";
import { holdPrivacyCover } from "@/lib/privacy-cover";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

let changeTo: (state: AppStateStatus) => void = () => undefined;

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    changeTo = (state) => listener(state);
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => jest.restoreAllMocks());

describe("PrivacyCover", () => {
  it("covers the screen while the app is inactive or in the background with a Sensitive section open", async () => {
    const release = holdPrivacyCover();
    await render(<PrivacyCover />);
    expect(screen.queryByTestId("privacy-cover")).toBeNull();

    await act(async () => changeTo("inactive"));
    expect(screen.getByTestId("privacy-cover")).toBeOnTheScreen();
    await act(async () => changeTo("background"));
    expect(screen.getByTestId("privacy-cover")).toBeOnTheScreen();
    await act(async () => changeTo("active"));
    expect(screen.queryByTestId("privacy-cover")).toBeNull();

    await act(async () => release());
  });

  it("covers nothing when no Sensitive section is open", async () => {
    await render(<PrivacyCover />);

    await act(async () => changeTo("inactive"));

    expect(screen.queryByTestId("privacy-cover")).toBeNull();
  });

  it("covers at once when a Section opens while the app is already inactive, and lifts when it closes", async () => {
    await render(<PrivacyCover />);
    await act(async () => changeTo("inactive"));

    let release: () => void = () => undefined;
    await act(async () => {
      release = holdPrivacyCover();
    });
    expect(screen.getByTestId("privacy-cover")).toBeOnTheScreen();

    await act(async () => release());
    expect(screen.queryByTestId("privacy-cover")).toBeNull();
  });
});
