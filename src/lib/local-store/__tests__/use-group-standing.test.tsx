import { act, renderHook } from "@testing-library/react-native";

import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import type { StoreRuntime } from "../runtime";
import { groupRow, groupUserRow, syncPage } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { useGroupStanding } from "../use-group-standing";

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore("user-1");
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

async function pullIn(page: Partial<SyncEnvelope>) {
  await act(async () => {
    store.write((transaction) => applyPage(transaction, syncPage(page), 1));
  });
}

describe("useGroupStanding", () => {
  it("returns the viewer's standing again once a membership lands", async () => {
    const { result } = await renderHook(() => useGroupStanding());
    expect(result.current).toEqual({ member: false, approver: false });

    await pullIn({
      groups: [groupRow({ managerUserId: "boss" })],
      groupUsers: [groupUserRow({ approverAccess: true })],
    });

    expect(result.current).toEqual({ member: true, approver: true });
  });
});
