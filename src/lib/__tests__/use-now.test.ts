import { act, renderHook } from "@testing-library/react-native";

import { useNow } from "../use-now";

describe("useNow", () => {
  it("returns the time it was first rendered at", async () => {
    const before = Date.now();

    const { result } = await renderHook(() => useNow(1_000));

    expect(result.current).toBeGreaterThanOrEqual(before);
    expect(result.current).toBeLessThanOrEqual(Date.now());
  });

  it("returns a later time once the interval has elapsed", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] });
    try {
      const { result } = await renderHook(() => useNow(1_000));
      const first = result.current;

      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });

      expect(result.current).toBeGreaterThan(first);
    } finally {
      jest.useRealTimers();
    }
  });
});
