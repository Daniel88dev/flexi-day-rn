import { act, renderHook } from "@testing-library/react-native";

import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import { activePendingChanges } from "../pending";
import type { StoreRuntime } from "../runtime";
import {
  groupRow,
  groupUserRow,
  syncPage,
  userYearQuotaRow,
  vacationRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { useBalanceBuckets } from "../use-balance";

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

const vacation = (buckets: ReturnType<typeof useBalanceBuckets>) =>
  buckets.find((bucket) => bucket.type === "VACATION");

describe("useBalanceBuckets", () => {
  it("returns the year's balance again once quotas and bookings land", async () => {
    await pullIn({ groups: [groupRow()], groupUsers: [groupUserRow()] });
    const { result } = await renderHook(() => useBalanceBuckets(2026));
    expect(vacation(result.current)).toMatchObject({ allocated: 0, used: 0 });

    await pullIn({
      userYearQuotas: [userYearQuotaRow({ vacationDays: 25 })],
      vacations: [vacationRow({ approvedAt: "2026-09-01T00:00:00.000Z" })],
    });

    expect(vacation(result.current)).toMatchObject({ allocated: 25, used: 1 });
  });

  it("returns a decision in flight over the row it holds", async () => {
    await pullIn({
      groups: [groupRow()],
      groupUsers: [groupUserRow()],
      vacations: [vacationRow()],
    });
    const { result } = await renderHook(() => useBalanceBuckets(2026));
    expect(vacation(result.current)).toMatchObject({ pending: 1 });

    await act(async () => {
      activePendingChanges().add({ kind: "cancel", vacationIds: ["vacation-1"] });
    });

    expect(vacation(result.current)).toMatchObject({ pending: 0 });
  });
});
