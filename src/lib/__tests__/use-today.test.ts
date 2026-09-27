import { act, renderHook } from "@testing-library/react-native";

import { createFakeAppState } from "@/test-support/fake-app-state";

import { useToday } from "../use-today";

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 14, 23, 0),
    doNotFake: ["setImmediate", "nextTick", "queueMicrotask"],
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useToday", () => {
  it("returns today", async () => {
    const { result } = await renderHook(() => useToday(createFakeAppState()));

    expect(result.current.getDate()).toBe(14);
  });

  it("returns the next day once midnight passes", async () => {
    const { result } = await renderHook(() => useToday(createFakeAppState()));

    await act(async () => {
      jest.advanceTimersByTime(2 * 60 * 60_000);
    });

    expect(result.current.getDate()).toBe(15);
  });

  it("returns the new day when the app comes back to the foreground on it", async () => {
    const appState = createFakeAppState();
    const { result } = await renderHook(() => useToday(appState));

    // The timer never fired: the app was suspended through midnight.
    jest.setSystemTime(new Date(2026, 9, 16, 8, 0));
    await act(async () => appState.becomeActive());

    expect(result.current.getDate()).toBe(16);
  });

  it("returns the same date object while the day has not changed", async () => {
    const appState = createFakeAppState();
    const { result } = await renderHook(() => useToday(appState));
    const first = result.current;

    jest.setSystemTime(new Date(2026, 9, 14, 23, 30));
    await act(async () => appState.becomeActive());

    expect(result.current).toBe(first);
  });
});
