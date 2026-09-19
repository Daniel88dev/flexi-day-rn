import { act, renderHook } from "@testing-library/react-native";

import { applyPage } from "../apply";
import type { StoreRuntime } from "../runtime";
import { fullSyncPage, syncPage, vacationRow } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { useStoreRowCounts } from "../use-store-row-counts";

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore();
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

async function applyInTest(page: Parameters<typeof applyPage>[1]) {
  await act(async () => {
    store.write((transaction) => applyPage(transaction, page, 1));
  });
}

describe("useStoreRowCounts", () => {
  it("returns zero for every table of a store nothing has pulled into", async () => {
    const { result } = await renderHook(() => useStoreRowCounts());

    expect(result.current).toMatchObject({ organizations: 0, vacations: 0 });
  });

  it("returns the counts again after a page lands", async () => {
    const { result } = await renderHook(() => useStoreRowCounts());

    await applyInTest(fullSyncPage());
    expect(result.current).toMatchObject({ groups: 1, vacations: 1 });

    await applyInTest(syncPage({ vacations: [vacationRow({ id: "vacation-2" })] }));

    expect(result.current).toMatchObject({ groups: 1, vacations: 2 });
  });
});
