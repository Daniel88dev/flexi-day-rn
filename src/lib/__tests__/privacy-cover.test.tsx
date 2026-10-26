import { act, renderHook } from "@testing-library/react-native";

import { holdPrivacyCover, usePrivacyCoverHeld } from "@/lib/privacy-cover";

describe("holdPrivacyCover", () => {
  it("returns a release, and the cover stays held until every holder lets go", async () => {
    const { result } = await renderHook(() => usePrivacyCoverHeld());
    expect(result.current).toBe(false);

    let first: () => void = () => undefined;
    let second: () => void = () => undefined;
    await act(async () => {
      first = holdPrivacyCover();
      second = holdPrivacyCover();
    });
    expect(result.current).toBe(true);

    await act(async () => {
      first();
      first();
    });
    expect(result.current).toBe(true);

    await act(async () => second());
    expect(result.current).toBe(false);
  });
});
