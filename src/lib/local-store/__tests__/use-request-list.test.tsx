import { act, renderHook } from "@testing-library/react-native";

import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import { activePendingChanges } from "../pending";
import type { StoreRuntime } from "../runtime";
import {
  groupRow,
  groupUserRow,
  syncPage,
  userRow,
  vacationRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { useRequestListVacations, useRequestScopeGroups } from "../use-request-list";

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

describe("useRequestScopeGroups", () => {
  it("returns the scope menu's groups again once a membership lands", async () => {
    const { result } = await renderHook(() => useRequestScopeGroups());
    expect(result.current).toEqual([]);

    await pullIn({ groups: [groupRow()], groupUsers: [groupUserRow()] });

    expect(result.current).toEqual([{ groupId: "group-1", groupName: "Engineering" }]);
  });
});

describe("useRequestListVacations", () => {
  const QUERY = {
    month: { year: 2026, month: 9 },
    scope: { kind: "group", groupId: "group-1" },
  } as const;

  it("returns the month's rows again once a page lands", async () => {
    await pullIn({ users: [userRow()], groups: [groupRow()], groupUsers: [groupUserRow()] });
    const { result } = await renderHook(() => useRequestListVacations(QUERY));
    expect(result.current).toEqual([]);

    await pullIn({ vacations: [vacationRow()] });

    expect(result.current).toEqual([
      expect.objectContaining({ id: "vacation-1", userName: "Ada", pending: false }),
    ]);
  });

  it("returns a row as pending while a change holds it", async () => {
    await pullIn({ groups: [groupRow()], vacations: [vacationRow()] });
    const { result } = await renderHook(() => useRequestListVacations(QUERY));

    await act(async () => {
      activePendingChanges().add({ kind: "cancel", vacationIds: ["vacation-1"] });
    });

    expect(result.current).toEqual([
      expect.objectContaining({ id: "vacation-1", status: "cancelled", pending: true }),
    ]);
  });
});
