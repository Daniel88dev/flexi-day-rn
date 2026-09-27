import { applyPage } from "../apply";
import { calendarBankHolidays, calendarVacations, type CalendarQuery } from "../calendar";
import type { SyncEnvelope } from "../envelope";
import { activePendingChanges } from "../pending";
import type { StoreRuntime } from "../runtime";
import {
  bankHolidayRow,
  groupRow,
  groupUserRow,
  syncPage,
  userRow,
  vacationRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

const VIEWER = "user-1";
const OCTOBER = { from: "2026-10-01", until: "2026-11-01" };
const MINE: CalendarQuery = { range: OCTOBER, scope: { kind: "mine" } };
const GROUP_1: CalendarQuery = { range: OCTOBER, scope: { kind: "group", groupId: "group-1" } };

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore(VIEWER);
  pullIn({
    users: [userRow({ id: VIEWER, name: "Dana Holt" }), userRow({ id: "user-2", name: "Eva" })],
    groups: [
      groupRow({ id: "group-1", groupName: "Engineering", holidayCountry: "CZ" }),
      groupRow({ id: "group-2", groupName: "Support", holidayCountry: "SK" }),
      groupRow({ id: "group-3", groupName: "Elsewhere", holidayCountry: "DE" }),
    ],
    groupUsers: [
      groupUserRow({ id: "gu-1", groupId: "group-1", userId: VIEWER }),
      groupUserRow({ id: "gu-2", groupId: "group-2", userId: VIEWER }),
      groupUserRow({ id: "gu-3", groupId: "group-1", userId: "user-2" }),
      groupUserRow({ id: "gu-4", groupId: "group-3", userId: "user-2" }),
    ],
  });
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function pullIn(page: Partial<SyncEnvelope>) {
  store.write((transaction) => applyPage(transaction, syncPage(page), 1));
}

describe("calendarVacations", () => {
  const ids = (query: CalendarQuery) =>
    calendarVacations(store.getDatabase(), activePendingChanges().list(), query).map((r) => r.id);

  it("returns the range's rows of everyone in the group, with their names", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "sep", requestedDay: "2026-09-30" }),
        vacationRow({ id: "mine", userId: VIEWER, requestedDay: "2026-10-14" }),
        vacationRow({ id: "eva", userId: "user-2", requestedDay: "2026-10-14" }),
        vacationRow({ id: "nov", requestedDay: "2026-11-01" }),
      ],
    });

    expect(calendarVacations(store.getDatabase(), [], GROUP_1)).toEqual([
      expect.objectContaining({ id: "eva", userName: "Eva" }),
      expect.objectContaining({ id: "mine", userName: "Dana Holt" }),
    ]);
  });

  it("returns only the viewer's rows for Mine", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "mine", userId: VIEWER, requestedDay: "2026-10-14" }),
        vacationRow({ id: "eva", userId: "user-2", requestedDay: "2026-10-14" }),
      ],
    });

    expect(ids(MINE)).toEqual(["mine"]);
  });

  it("returns pending and approved rows and leaves out rejected and cancelled ones", () => {
    pullIn({
      vacations: [
        vacationRow({ id: "pending", requestedDay: "2026-10-12" }),
        vacationRow({ id: "approved", requestedDay: "2026-10-13", approvedAt: "2026-10-01" }),
        vacationRow({ id: "rejected", requestedDay: "2026-10-14", rejectedAt: "2026-10-01" }),
        vacationRow({ id: "cancelled", requestedDay: "2026-10-15", deletedAt: "2026-10-01" }),
      ],
    });

    expect(ids(GROUP_1)).toEqual(["pending", "approved"]);
  });

  it("returns a create in flight as pending rows", () => {
    activePendingChanges().add({
      kind: "create",
      draft: { groupId: "group-1", from: "2026-10-14", to: "2026-10-14" },
    });

    expect(calendarVacations(store.getDatabase(), activePendingChanges().list(), MINE)).toEqual([
      expect.objectContaining({ requestedDay: "2026-10-14", status: "pending" }),
    ]);
  });
});

describe("calendarBankHolidays", () => {
  beforeEach(() => {
    pullIn({
      bankHolidays: [
        bankHolidayRow({ id: "cz", date: "2026-10-28", name: "Statehood", country: "CZ" }),
        bankHolidayRow({ id: "sk", date: "2026-10-30", name: "Declaration", country: "SK" }),
        bankHolidayRow({ id: "de", date: "2026-10-03", name: "Unity", country: "DE" }),
        bankHolidayRow({ id: "cz-nov", date: "2026-11-17", name: "Freedom", country: "CZ" }),
      ],
    });
  });

  it("returns the range's holidays of every country across the viewer's groups for Mine", () => {
    expect(calendarBankHolidays(store.getDatabase(), MINE)).toEqual([
      { date: "2026-10-28", name: "Statehood" },
      { date: "2026-10-30", name: "Declaration" },
    ]);
  });

  it("returns only the chosen group's country for Group", () => {
    expect(calendarBankHolidays(store.getDatabase(), GROUP_1)).toEqual([
      { date: "2026-10-28", name: "Statehood" },
    ]);
  });

  it("returns nothing for a group without a holiday country", () => {
    pullIn({
      groups: [groupRow({ id: "group-1", groupName: "Engineering", holidayCountry: null })],
    });

    expect(calendarBankHolidays(store.getDatabase(), GROUP_1)).toEqual([]);
  });
});
