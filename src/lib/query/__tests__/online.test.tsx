import { onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useOnline } from "@/lib/query/online";

afterEach(() => onlineManager.setOnline(true));

describe("useOnline", () => {
  it("returns true while the online manager says online", async () => {
    onlineManager.setOnline(true);

    const { result } = await renderHook(() => useOnline());

    expect(result.current).toBe(true);
  });

  it("returns false once the phone goes offline, and true again on reconnect", async () => {
    const { result } = await renderHook(() => useOnline());

    await act(async () => onlineManager.setOnline(false));
    expect(result.current).toBe(false);

    await act(async () => onlineManager.setOnline(true));
    expect(result.current).toBe(true);
  });
});
