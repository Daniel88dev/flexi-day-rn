import { act, renderHook } from "@testing-library/react-native";

import { useMonthRanges } from "@/components/calendar/use-month-ranges";
import { LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { applyPage } from "@/lib/local-store/apply";
import type { SyncEnvelope } from "@/lib/local-store/envelope";
import type { StoreRuntime } from "@/lib/local-store/runtime";
import {
  groupRow,
  groupUserRow,
  syncPage,
  userRow,
  vacationRow,
} from "@/lib/local-store/test-support/sync-fixtures";
import { openTestStore } from "@/lib/local-store/test-support/test-store";

// The store's interface module pulls the session in; the hook needs only the calendar reads.
jest.mock("@/lib/local-store", () => jest.requireActual("@/lib/local-store/use-calendar"));

const MONTH = { year: 2026, month: 9 };
const SCOPE = { kind: "group", groupId: "group-1" } as const;

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

/** Bob, a teammate in the viewer's group, on a day his Sick arrives as Away. */
function pullInBobAway() {
  return pullIn({
    users: [userRow(), userRow({ id: "user-2", name: "Bob Dvorak" })],
    groups: [groupRow()],
    groupUsers: [groupUserRow(), groupUserRow({ id: "gu-bob", userId: "user-2" })],
    vacations: [
      vacationRow({
        id: "bob-sick",
        userId: "user-2",
        createdByUserId: "user-2",
        vacationType: "AWAY",
      }),
    ],
  });
}

describe("useMonthRanges", () => {
  it("keeps a teammate's Away row on the calendar under the dashboard's default filter", async () => {
    await pullInBobAway();

    const { result } = await renderHook(() =>
      useMonthRanges(MONTH, SCOPE, new Set(LEAVE_TYPE_ORDER))
    );

    expect(result.current).toEqual([expect.objectContaining({ type: "AWAY" })]);
  });

  it("leaves a teammate's Away row out when the filter shows only Sick", async () => {
    await pullInBobAway();

    const { result } = await renderHook(() => useMonthRanges(MONTH, SCOPE, new Set(["SICK"])));

    expect(result.current).toEqual([]);
  });
});
