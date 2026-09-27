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
import {
  useMemberGroups,
  useRequestListVacations,
  useRequestScopeGroups,
  useStoredRequest,
} from "../use-request-list";

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

describe("useMemberGroups", () => {
  it("returns the groups the viewer may book in again once a membership lands", async () => {
    const { result } = await renderHook(() => useMemberGroups());
    expect(result.current).toEqual([]);

    await pullIn({
      groups: [groupRow()],
      groupUsers: [groupUserRow({ viewAccess: false, adminAccess: false })],
    });

    expect(result.current).toEqual([{ groupId: "group-1", groupName: "Engineering" }]);
  });
});

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

  it("returns a Provisional row as pending until its mark lifts", async () => {
    await pullIn({ groups: [groupRow()], vacations: [vacationRow({ approvedAt: "2026-09-20" })] });
    const { result } = await renderHook(() => useRequestListVacations(QUERY));

    let markId = "";
    await act(async () => {
      markId = activePendingChanges().markProvisional(["vacation-1"]).id;
    });
    expect(result.current).toEqual([
      expect.objectContaining({ id: "vacation-1", status: "approved", pending: true }),
    ]);

    await act(async () => {
      activePendingChanges().remove(markId);
    });
    expect(result.current).toEqual([expect.objectContaining({ pending: false })]);
  });
});

describe("useStoredRequest", () => {
  it("returns the stored run again once the day lands, and marked while a mark holds it", async () => {
    await pullIn({ users: [userRow()], groups: [groupRow()] });
    const { result } = await renderHook(() => useStoredRequest("vacation-1"));
    expect(result.current).toBeNull();

    await pullIn({ vacations: [vacationRow()] });
    expect(result.current).toEqual(
      expect.objectContaining({ vacationIds: ["vacation-1"], userName: "Ada", pending: false })
    );

    await act(async () => {
      activePendingChanges().markProvisional(["vacation-1"]);
    });
    expect(result.current).toEqual(expect.objectContaining({ pending: true }));
  });
});
