import { eq } from "drizzle-orm";

import type { StoreDatabase } from "../adapter";
import { applyPage, sweepGenerations, writeSyncState } from "../apply";
import { SYNC_TABLE_NAMES } from "../envelope";
import type { StoreRuntime } from "../runtime";
import {
  bankHolidays,
  groupMirrors,
  groupUsers,
  groups,
  organizations,
  syncState,
  userYearQuotas,
  users,
  vacations,
} from "../schema";
import {
  bankHolidayRow,
  fullSyncPage,
  groupMirrorRow,
  groupUserRow,
  groupRow,
  syncPage,
  vacationRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore();
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function allRows(db: StoreDatabase) {
  return {
    organizations: db.select().from(organizations).all(),
    users: db.select().from(users).all(),
    groups: db.select().from(groups).all(),
    groupUsers: db.select().from(groupUsers).all(),
    groupMirrors: db.select().from(groupMirrors).all(),
    userYearQuotas: db.select().from(userYearQuotas).all(),
    bankHolidays: db.select().from(bankHolidays).all(),
    vacations: db.select().from(vacations).all(),
  };
}

function apply(page: Parameters<typeof applyPage>[1], generation = 1) {
  store.write((transaction) => applyPage(transaction, page, generation));
}

describe("applyPage", () => {
  it("applies the tables in the envelope's order", () => {
    const touched: string[] = [];

    store.write((transaction) =>
      applyPage({ db: transaction.db, touch: (table) => touched.push(table) }, fullSyncPage(), 1)
    );

    expect(touched).toEqual([
      "organizations",
      "users",
      "groups",
      "groupUsers",
      "groupMirrors",
      "userYearQuotas",
      "bankHolidays",
      "vacations",
    ]);
    expect(touched).toEqual([...SYNC_TABLE_NAMES]);
  });

  it("writes a row into every table of the envelope", () => {
    apply(fullSyncPage());

    const rows = allRows(store.getDatabase());
    expect(Object.values(rows).map((table) => table.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(rows.groups[0].workingDays).toEqual([1, 2, 3, 4, 5]);
    expect(rows.groupUsers[0].viewAccess).toBe(true);
  });

  it("changes nothing when the same page is applied twice", () => {
    apply(fullSyncPage());
    const first = allRows(store.getDatabase());

    apply(fullSyncPage());

    expect(allRows(store.getDatabase())).toEqual(first);
  });

  it("overwrites a row by id when the page carries a newer one", () => {
    apply(fullSyncPage());

    apply(
      syncPage({
        groups: [groupRow({ groupName: "Platform", holidayCountry: null })],
        vacations: [vacationRow({ note: "moved", halfDay: true })],
      })
    );

    const rows = allRows(store.getDatabase());
    expect(rows.groups).toHaveLength(1);
    expect(rows.groups[0]).toMatchObject({ groupName: "Platform", holidayCountry: null });
    expect(rows.vacations[0]).toMatchObject({ note: "moved", halfDay: true });
  });

  it("deletes the local row for a group, membership and mirror tombstone", () => {
    apply(fullSyncPage());

    apply(
      syncPage({
        groups: [groupRow({ deletedAt: "2026-09-20T08:00:00.000Z" })],
        groupUsers: [groupUserRow({ deletedAt: "2026-09-20T08:00:00.000Z" })],
        groupMirrors: [groupMirrorRow({ deletedAt: "2026-09-20T08:00:00.000Z" })],
      })
    );

    const rows = allRows(store.getDatabase());
    expect(rows.groups).toEqual([]);
    expect(rows.groupUsers).toEqual([]);
    expect(rows.groupMirrors).toEqual([]);
    expect(rows.vacations).toHaveLength(1);
  });

  it("keeps a live row the same page carries beside a tombstone", () => {
    apply(
      syncPage({
        groupUsers: [
          groupUserRow({ id: "group-user-1" }),
          groupUserRow({ id: "group-user-2", userId: "user-2" }),
        ],
      })
    );

    apply(
      syncPage({
        groupUsers: [
          groupUserRow({ id: "group-user-1", deletedAt: "2026-09-20T08:00:00.000Z" }),
          groupUserRow({ id: "group-user-2", userId: "user-2", approverAccess: true }),
        ],
      })
    );

    const rows = store.getDatabase().select().from(groupUsers).all();
    expect(rows.map((row) => row.id)).toEqual(["group-user-2"]);
    expect(rows[0].approverAccess).toBe(true);
  });

  it("keeps a cancelled vacation as history rather than deleting it", () => {
    apply(fullSyncPage());

    apply(syncPage({ vacations: [vacationRow({ deletedAt: "2026-09-20T08:00:00.000Z" })] }));

    expect(store.getDatabase().select().from(vacations).all()).toEqual([
      expect.objectContaining({ id: "vacation-1", deletedAt: "2026-09-20T08:00:00.000Z" }),
    ]);
  });

  it("stamps every row it writes with the generation it was given", () => {
    apply(fullSyncPage(), 7);

    for (const rows of Object.values(allRows(store.getDatabase()))) {
      expect(rows.map((row) => row.generation)).toEqual([7]);
    }
  });

  it("restamps a row the next generation carries again", () => {
    apply(fullSyncPage(), 1);

    apply(syncPage({ vacations: [vacationRow()] }), 2);

    const rows = allRows(store.getDatabase());
    expect(rows.vacations[0].generation).toBe(2);
    expect(rows.groups[0].generation).toBe(1);
  });

  it("writes a page carrying more rows than one statement can bind", () => {
    const holidays = Array.from({ length: 400 }, (_, index) =>
      bankHolidayRow({ id: `holiday-${index}`, date: `2026-01-${(index % 28) + 1}` })
    );

    apply(syncPage({ bankHolidays: holidays }));

    expect(store.getDatabase().select().from(bankHolidays).all()).toHaveLength(400);
  });

  it("leaves a table the page carries empty alone", () => {
    apply(fullSyncPage());

    apply(syncPage({ users: [] }));

    expect(store.getDatabase().select().from(users).all()).toHaveLength(1);
  });
});

describe("sweepGenerations", () => {
  it("deletes rows of an older generation in every synced table", () => {
    apply(fullSyncPage(), 1);

    store.write((transaction) => sweepGenerations(transaction, 2));

    const rows = allRows(store.getDatabase());
    expect(Object.values(rows).flat()).toEqual([]);
  });

  it("leaves the current generation's rows alone", () => {
    apply(fullSyncPage(), 1);
    apply(syncPage({ vacations: [vacationRow({ id: "vacation-2" })] }), 2);

    store.write((transaction) => sweepGenerations(transaction, 2));

    const rows = allRows(store.getDatabase());
    expect(rows.vacations.map((row) => row.id)).toEqual(["vacation-2"]);
    expect(rows.groups).toEqual([]);
  });

  it("leaves the sync state alone", () => {
    store.write((transaction) => sweepGenerations(transaction, 9));

    expect(store.getDatabase().select().from(syncState).all()).toHaveLength(1);
  });
});

describe("writeSyncState", () => {
  it("stores the cursor, the pull time and the generation on the one row", () => {
    store.write((transaction) =>
      writeSyncState(transaction, {
        cursor: "opaque-cursor",
        lastPulledAt: "2026-09-19T13:00:00.000Z",
        generation: 3,
      })
    );

    expect(store.getDatabase().select().from(syncState).all()).toEqual([
      {
        id: 1,
        userId: "user-1",
        cursor: "opaque-cursor",
        lastPulledAt: "2026-09-19T13:00:00.000Z",
        generation: 3,
      },
    ]);
  });

  it("applies a page, sweeps and writes the sync state in one transaction", () => {
    apply(fullSyncPage(), 1);

    store.write((transaction) => {
      applyPage(transaction, syncPage({ vacations: [vacationRow({ id: "vacation-2" })] }), 2);
      sweepGenerations(transaction, 2);
      writeSyncState(transaction, { cursor: "next", generation: 2 });
    });

    expect(
      store
        .getDatabase()
        .select()
        .from(vacations)
        .all()
        .map((row) => row.id)
    ).toEqual(["vacation-2"]);
    expect(
      store
        .getDatabase()
        .select({ cursor: syncState.cursor })
        .from(syncState)
        .where(eq(syncState.id, 1))
        .all()
    ).toEqual([{ cursor: "next" }]);
  });

  it("rolls the whole transaction back when one of its steps throws", () => {
    apply(fullSyncPage(), 1);

    expect(() =>
      store.write((transaction) => {
        sweepGenerations(transaction, 2);
        writeSyncState(transaction, { cursor: "next" });
        throw new Error("page failed");
      })
    ).toThrow("page failed");

    const rows = allRows(store.getDatabase());
    expect(rows.vacations).toHaveLength(1);
    expect(store.getDatabase().select().from(syncState).all()[0].cursor).toBeNull();
  });
});
