import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useScreenReaderEnabled } from "../use-screen-reader";

let changed: (enabled: boolean) => void = () => {};
const remove = jest.fn();

beforeEach(() => {
  remove.mockClear();
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_event, handler) => {
    changed = handler as unknown as (enabled: boolean) => void;
    return { remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
});

afterEach(() => jest.restoreAllMocks());

describe("useScreenReaderEnabled", () => {
  it("returns whether the screen reader runs, and follows it turning off", async () => {
    const { result, unmount } = await renderHook(() => useScreenReaderEnabled());

    await waitFor(() => expect(result.current).toBe(true));
    await act(async () => changed(false));
    expect(result.current).toBe(false);

    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
