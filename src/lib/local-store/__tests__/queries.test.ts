import { eq } from "drizzle-orm";

import { applyPage } from "../apply";
import { activePendingChanges, type PendingChange, type VacationDraft } from "../pending";
import { mergedVacations, selectVacations, storeRowCounts } from "../queries";
import type { StoreRuntime } from "../runtime";
import { vacations } from "../schema";
import {
  bankHolidayRow,
  fullSyncPage,
  groupRow,
  syncPage,
  vacationRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

const APPROVED = "2026-09-20T08:00:00.000Z";
const REJECTED = "2026-09-20T09:00:00.000Z";
const CANCELLED = "2026-09-20T10:00:00.000Z";

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore();
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function statusOf(id: string): string | undefined {
  const [row] = selectVacations(store.getDatabase()).where(eq(vacations.id, id)).all();
  return row?.status;
}

describe("selectVacations", () => {
  beforeEach(() => {
    store.write((transaction) =>
      applyPage(
        transaction,
        syncPage({
          vacations: [
            vacationRow({ id: "pending" }),
            vacationRow({ id: "approved", approvedAt: APPROVED, approvedBy: "user-2" }),
            vacationRow({ id: "rejected", rejectedAt: REJECTED, rejectedBy: "user-2" }),
            vacationRow({ id: "cancelled", deletedAt: CANCELLED, deletedByUserId: "user-1" }),
            vacationRow({
              id: "approved-then-cancelled",
              approvedAt: APPROVED,
              deletedAt: CANCELLED,
            }),
          ],
        }),
        1
      )
    );
  });

  it("returns pending for a booking the server has not decided", () => {
    expect(statusOf("pending")).toBe("pending");
  });

  it("returns approved for a booking with an approval timestamp", () => {
    expect(statusOf("approved")).toBe("approved");
  });

  it("returns rejected for a booking with a rejection timestamp", () => {
    expect(statusOf("rejected")).toBe("rejected");
  });

  it("returns cancelled for a booking with a deletion timestamp", () => {
    expect(statusOf("cancelled")).toBe("cancelled");
  });

  it("returns cancelled for an approved booking that was cancelled after", () => {
    expect(statusOf("approved-then-cancelled")).toBe("cancelled");
  });

  it("returns the booking's own columns and not the store's generation stamp", () => {
    const [row] = selectVacations(store.getDatabase()).where(eq(vacations.id, "approved")).all();

    expect(row).toMatchObject({
      id: "approved",
      userId: "user-1",
      groupId: "group-1",
      vacationType: "VACATION",
      halfDay: false,
      approvedBy: "user-2",
      status: "approved",
    });
    expect(row).not.toHaveProperty("generation");
  });

  it("returns every booking the store holds when nothing narrows it", () => {
    expect(selectVacations(store.getDatabase()).all()).toHaveLength(5);
  });
});

describe("storeRowCounts", () => {
  it("returns zero for every table of a store nothing has pulled into", () => {
    expect(storeRowCounts(store.getDatabase())).toEqual({
      organizations: 0,
      users: 0,
      groups: 0,
      groupUsers: 0,
      groupMirrors: 0,
      userYearQuotas: 0,
      bankHolidays: 0,
      vacations: 0,
    });
  });

  it("returns what a page wrote, table by table", () => {
    store.write((transaction) =>
      applyPage(
        transaction,
        fullSyncPage({ vacations: [vacationRow(), vacationRow({ id: "vacation-2" })] }),
        1
      )
    );

    expect(storeRowCounts(store.getDatabase())).toEqual({
      organizations: 1,
      users: 1,
      groups: 1,
      groupUsers: 1,
      groupMirrors: 1,
      userYearQuotas: 1,
      bankHolidays: 1,
      vacations: 2,
    });
  });
});

describe("mergedVacations", () => {
  const DRAFT: VacationDraft = { groupId: "group-1", from: "2026-09-21", to: "2026-09-27" };

  beforeEach(() => {
    store.write((transaction) =>
      applyPage(
        transaction,
        syncPage({
          groups: [groupRow()],
          bankHolidays: [
            bankHolidayRow({ id: "holiday-cz", date: "2026-09-23", country: "CZ" }),
            bankHolidayRow({ id: "holiday-sk", date: "2026-09-24", country: "SK" }),
          ],
        }),
        1
      )
    );
  });

  function create(draft: Partial<VacationDraft> = {}): PendingChange {
    return activePendingChanges().add({ kind: "create", draft: { ...DRAFT, ...draft } });
  }

  function merged() {
    return mergedVacations(store.getDatabase(), activePendingChanges().list());
  }

  function daysOf(): string[] {
    return merged().map((row) => row.requestedDay);
  }

  it("returns one row per working day of the range, weekends and the group's holidays apart", () => {
    create();

    expect(daysOf()).toEqual(["2026-09-21", "2026-09-22", "2026-09-24", "2026-09-25"]);
  });

  it("returns no row on a day the group does not work", () => {
    create();

    expect(daysOf()).not.toContain("2026-09-26");
    expect(daysOf()).not.toContain("2026-09-27");
  });

  it("returns no row on a bank holiday in the group's own country", () => {
    create();

    expect(daysOf()).not.toContain("2026-09-23");
  });

  it("returns a row on a bank holiday of a country the group does not follow", () => {
    create();

    expect(daysOf()).toContain("2026-09-24");
  });

  it("returns every day of the range when the group follows no holiday calendar", () => {
    store.write((transaction) =>
      applyPage(transaction, syncPage({ groups: [groupRow({ holidayCountry: null })] }), 1)
    );
    create();

    expect(daysOf()).toContain("2026-09-23");
  });

  it("returns the rows a create expects, marked pending with their actions disabled", () => {
    const change = create({ from: "2026-09-21", to: "2026-09-21", note: "Skiing" });

    expect(merged()).toEqual([
      expect.objectContaining({
        id: `${change.id}:2026-09-21`,
        requestId: change.id,
        requestedDay: "2026-09-21",
        userId: "user-1",
        groupId: "group-1",
        organizationId: "org-1",
        vacationType: "VACATION",
        halfDay: false,
        note: "Skiing",
        status: "pending",
        pending: true,
        actionsDisabled: true,
      }),
    ]);
  });

  it("returns the draft's own type, times and member where it named them", () => {
    create({
      from: "2026-09-21",
      to: "2026-09-21",
      vacationType: "HOME_OFFICE",
      startTime: "09:00:00",
      endTime: "13:00:00",
      halfDay: true,
      userId: "user-2",
    });

    expect(merged()).toEqual([
      expect.objectContaining({
        userId: "user-2",
        vacationType: "HOME_OFFICE",
        startTime: "09:00:00",
        endTime: "13:00:00",
        halfDay: true,
      }),
    ]);
  });

  it("returns no rows for a create in a group the store has never pulled", () => {
    create({ groupId: "group-404" });

    expect(merged()).toEqual([]);
  });

  it("returns the store's own rows untouched while nothing is in flight", () => {
    store.write((transaction) =>
      applyPage(transaction, syncPage({ vacations: [vacationRow()] }), 1)
    );

    expect(merged()).toEqual([
      expect.objectContaining({ id: "vacation-1", pending: false, actionsDisabled: false }),
    ]);
  });

  it("returns a stored row with its actions disabled while a change holds it", () => {
    store.write((transaction) =>
      applyPage(transaction, syncPage({ vacations: [vacationRow()] }), 1)
    );
    activePendingChanges().add({ kind: "approve", vacationIds: ["vacation-1"] });

    expect(merged()).toEqual([
      expect.objectContaining({ id: "vacation-1", pending: false, actionsDisabled: true }),
    ]);
  });

  it("returns the stored rows and the expanded ones as one list, in day order", () => {
    store.write((transaction) =>
      applyPage(
        transaction,
        syncPage({ vacations: [vacationRow({ id: "vacation-1", requestedDay: "2026-09-23" })] }),
        1
      )
    );
    create();

    expect(daysOf()).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
  });

  it("returns nothing for a range that reads backwards", () => {
    create({ from: "2026-09-25", to: "2026-09-21" });

    expect(merged()).toEqual([]);
  });
});
