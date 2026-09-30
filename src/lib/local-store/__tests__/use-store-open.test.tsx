import { act, renderHook } from "@testing-library/react-native";

import type { StoreRuntime } from "../runtime";
import { installTestStore } from "../test-support/test-store";
import { useStoreOpen } from "../use-store-open";

let store: StoreRuntime;

beforeEach(() => {
  store = installTestStore();
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function renderCounted() {
  let renders = 0;
  const hook = renderHook(() => {
    renders += 1;
    return useStoreOpen();
  });
  return { hook, renders: () => renders };
}

describe("useStoreOpen", () => {
  it("returns false before the store opens", async () => {
    const { result } = await renderHook(() => useStoreOpen());

    expect(result.current).toBe(false);
  });

  it("returns true once the store has opened", async () => {
    const { result } = await renderHook(() => useStoreOpen());

    await act(() => store.lifecycle.openStore("user-1"));

    expect(result.current).toBe(true);
  });

  it("returns false again once the store is destroyed", async () => {
    await store.lifecycle.openStore("user-1");
    const { result } = await renderHook(() => useStoreOpen());
    expect(result.current).toBe(true);

    await act(() => store.lifecycle.destroyStore());

    expect(result.current).toBe(false);
  });

  it("re-renders a mounted consumer on each change and not otherwise", async () => {
    const { hook, renders } = renderCounted();
    const { result } = await hook;
    const settled = renders();

    await act(() => store.lifecycle.openStore("user-1"));
    expect(result.current).toBe(true);
    expect(renders()).toBe(settled + 1);

    await act(() => store.lifecycle.openStore("user-1"));
    expect(renders()).toBe(settled + 1);

    await act(() => store.lifecycle.destroyStore());
    expect(result.current).toBe(false);
    expect(renders()).toBe(settled + 2);
  });
});
