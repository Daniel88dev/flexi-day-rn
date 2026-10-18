import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";

import { SHEET_DISMISS_MS, useAfterDismiss } from "../use-after-dismiss";

const os = Platform.OS;

beforeEach(() => jest.useFakeTimers());

afterEach(() => {
  Platform.OS = os;
  jest.useRealTimers();
});

describe("useAfterDismiss", () => {
  it("returns a closeThen that closes the sheet and runs the next step once iOS says it hid", async () => {
    Platform.OS = "ios";
    const close = jest.fn();
    const next = jest.fn();
    const { result } = await renderHook(() => useAfterDismiss(close));

    await act(async () => result.current.closeThen(next));
    expect(close).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(SHEET_DISMISS_MS));
    expect(next).not.toHaveBeenCalled();

    await act(async () => result.current.onDismiss());
    expect(next).toHaveBeenCalledTimes(1);
    await act(async () => result.current.onDismiss());
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns a closeThen that waits out the slide where the Modal never reports it hid", async () => {
    Platform.OS = "android";
    const next = jest.fn();
    const { result } = await renderHook(() => useAfterDismiss(jest.fn()));

    await act(async () => result.current.closeThen(next));
    expect(next).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(SHEET_DISMISS_MS));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("drops a pending step when the sheet unmounts first", async () => {
    Platform.OS = "android";
    const next = jest.fn();
    const { result, unmount } = await renderHook(() => useAfterDismiss(jest.fn()));

    await act(async () => result.current.closeThen(next));
    await unmount();
    await act(async () => jest.advanceTimersByTime(SHEET_DISMISS_MS));
    expect(next).not.toHaveBeenCalled();
  });
});
