import { act, renderHook } from "@testing-library/react-native";

import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import type { StoreRuntime } from "../runtime";
import {
  bankHolidayRow,
  birthdayRow,
  groupEventRow,
  groupRow,
  groupUserRow,
  syncPage,
  userRow,
  vacationRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import {
  useCalendarBankHolidays,
  useCalendarBirthdays,
  useCalendarGroupEvents,
  useCalendarVacations,
} from "../use-calendar";

const QUERY = {
  range: { from: "2026-09-01", until: "2026-10-01" },
  scope: { kind: "group", groupId: "group-1" },
} as const;

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

describe("useCalendarVacations", () => {
  it("returns the range's rows again once a page lands", async () => {
    await pullIn({ users: [userRow()], groups: [groupRow()], groupUsers: [groupUserRow()] });
    const { result } = await renderHook(() => useCalendarVacations(QUERY));
    expect(result.current).toEqual([]);

    await pullIn({ vacations: [vacationRow()] });

    expect(result.current).toEqual([expect.objectContaining({ id: "vacation-1" })]);
  });
});

describe("useCalendarBankHolidays", () => {
  it("returns the range's holidays again once the group's country lands", async () => {
    await pullIn({ bankHolidays: [bankHolidayRow({ date: "2026-09-28", name: "Statehood" })] });
    const { result } = await renderHook(() => useCalendarBankHolidays(QUERY));
    expect(result.current).toEqual([]);

    await pullIn({ groups: [groupRow({ holidayCountry: "CZ" })] });

    expect(result.current).toEqual([{ date: "2026-09-28", name: "Statehood" }]);
  });
});

describe("useCalendarBirthdays", () => {
  it("returns a colleague's shared birthday once their membership lands", async () => {
    await pullIn({
      users: [userRow({ id: "eva", name: "Eva Novak" })],
      birthdays: [birthdayRow({ userId: "eva", month: 9, day: 14, year: null, shared: true })],
    });
    const { result } = await renderHook(() => useCalendarBirthdays(QUERY));
    expect(result.current).toEqual([]);

    await pullIn({ groupUsers: [groupUserRow({ id: "gu-eva", userId: "eva" })] });

    expect(result.current).toEqual([
      { userId: "eva", userName: "Eva Novak", date: "2026-09-14", age: null, own: false },
    ]);
  });
});

describe("useCalendarGroupEvents", () => {
  it("returns a group's event once the event lands, and drops it on its tombstone", async () => {
    await pullIn({ groups: [groupRow()], groupUsers: [groupUserRow()] });
    const { result } = await renderHook(() => useCalendarGroupEvents(QUERY));
    expect(result.current).toEqual([]);

    await pullIn({
      groupEvents: [groupEventRow({ startDate: "2026-09-07", endDate: "2026-09-07" })],
    });

    expect(result.current.map((event) => event.startDate)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);

    await pullIn({
      groupEvents: [groupEventRow({ title: null, deletedAt: "2026-09-20T08:00:00.000Z" })],
    });

    expect(result.current).toEqual([]);
  });
});
