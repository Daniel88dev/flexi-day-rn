import { act, renderHook } from "@testing-library/react-native";

import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import type { StoreRuntime } from "../runtime";
import { groupRow, groupUserRow, organizationRow, syncPage } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { useMyGroups } from "../use-my-groups";

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

describe("useMyGroups", () => {
  it("returns the group again once a membership lands", async () => {
    await pullIn({ groups: [groupRow({ managerUserId: "boss" })] });
    const { result } = await renderHook(() => useMyGroups());
    expect(result.current).toEqual([]);

    await pullIn({ groupUsers: [groupUserRow({ approverAccess: true })] });

    expect(result.current.map(({ id, role }) => ({ id, role }))).toEqual([
      { id: "group-1", role: "approver" },
    ]);
  });

  it("returns the organization's name once the organization lands", async () => {
    await pullIn({ groups: [groupRow()], groupUsers: [groupUserRow()] });
    const { result } = await renderHook(() => useMyGroups());
    expect(result.current[0]?.organizationName).toBeNull();

    await pullIn({ organizations: [organizationRow({ name: "Northwind" })] });

    expect(result.current[0]?.organizationName).toBe("Northwind");
  });
});
