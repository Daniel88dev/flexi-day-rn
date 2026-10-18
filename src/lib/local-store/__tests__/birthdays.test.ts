import { applyPage } from "../apply";
import { calendarBirthdays } from "../birthdays";
import type { SyncEnvelope } from "../envelope";
import type { StoreRuntime } from "../runtime";
import {
  birthdayRow,
  groupRow,
  groupUserRow,
  syncPage,
  userRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

const VIEWER = "me";
const OCTOBER = { from: "2026-10-01", until: "2026-11-01" };

let store: StoreRuntime;

function apply(page: Partial<SyncEnvelope>) {
  store.write((transaction) => applyPage(transaction, syncPage(page), 1));
}

function read(query: Parameters<typeof calendarBirthdays>[1]) {
  return calendarBirthdays(store.getDatabase(), query);
}

beforeEach(async () => {
  store = await openTestStore(VIEWER);
  apply({
    users: [
      userRow({ id: VIEWER, name: "Dana Holt" }),
      userRow({ id: "eva", name: "Eva Novak" }),
      userRow({ id: "tom", name: "Tom Berg" }),
    ],
    groups: [
      groupRow({ id: "g-design", groupName: "Design" }),
      groupRow({ id: "g-platform", groupName: "Platform" }),
    ],
    groupUsers: [
      groupUserRow({ id: "gu-1", groupId: "g-design", userId: VIEWER }),
      groupUserRow({ id: "gu-2", groupId: "g-platform", userId: VIEWER }),
      groupUserRow({ id: "gu-3", groupId: "g-design", userId: "eva" }),
      groupUserRow({ id: "gu-4", groupId: "g-platform", userId: "tom" }),
    ],
    birthdays: [
      birthdayRow({ userId: VIEWER, month: 10, day: 25, year: 1987 }),
      birthdayRow({ userId: "eva", month: 10, day: 14, year: 1992, shared: true }),
      birthdayRow({ userId: "tom", month: 10, day: 20, year: null, shared: true }),
    ],
  });
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

describe("calendarBirthdays", () => {
  it("returns only the viewer's own birthday in Mine scope", () => {
    expect(read({ range: OCTOBER, scope: { kind: "mine" } })).toEqual([
      { userId: VIEWER, userName: "Dana Holt", date: "2026-10-25", age: 39, own: true },
    ]);
  });

  it("returns the group's shared birthdays and the viewer's own in Group scope", () => {
    expect(read({ range: OCTOBER, scope: { kind: "group", groupId: "g-design" } })).toEqual([
      { userId: "eva", userName: "Eva Novak", date: "2026-10-14", age: 34, own: false },
      { userId: VIEWER, userName: "Dana Holt", date: "2026-10-25", age: 39, own: true },
    ]);
    expect(read({ range: OCTOBER, scope: { kind: "group", groupId: "g-platform" } })).toEqual([
      { userId: "tom", userName: "Tom Berg", date: "2026-10-20", age: null, own: false },
      { userId: VIEWER, userName: "Dana Holt", date: "2026-10-25", age: 39, own: true },
    ]);
  });

  it("leaves out a colleague's birthday they do not share", () => {
    apply({ birthdays: [birthdayRow({ userId: "eva", month: 10, day: 14, shared: false })] });

    expect(
      read({ range: OCTOBER, scope: { kind: "group", groupId: "g-design" } }).map((b) => b.userId)
    ).toEqual([VIEWER]);
  });

  it("drops a colleague who left the group before any snapshot sweeps their birthday", () => {
    apply({
      groupUsers: [
        groupUserRow({
          id: "gu-3",
          groupId: "g-design",
          userId: "eva",
          deletedAt: "2026-10-10T08:00:00.000Z",
        }),
      ],
    });

    expect(
      read({ range: OCTOBER, scope: { kind: "group", groupId: "g-design" } }).map((b) => b.userId)
    ).toEqual([VIEWER]);
  });

  it("drops a birthday its tombstone removed", () => {
    apply({
      birthdays: [
        birthdayRow({
          userId: "eva",
          month: null,
          day: null,
          year: null,
          deletedAt: "2026-10-10T08:00:00.000Z",
        }),
      ],
    });

    expect(
      read({ range: OCTOBER, scope: { kind: "group", groupId: "g-design" } }).map((b) => b.userId)
    ).toEqual([VIEWER]);
  });

  it("shows 29 February on 28 February in 2027 with the age turned that day", () => {
    apply({
      birthdays: [birthdayRow({ userId: "eva", month: 2, day: 29, year: 1990, shared: true })],
    });

    expect(
      read({
        range: { from: "2027-02-01", until: "2027-03-01" },
        scope: { kind: "group", groupId: "g-design" },
      })
    ).toEqual([{ userId: "eva", userName: "Eva Novak", date: "2027-02-28", age: 37, own: false }]);
  });

  it("returns a birthday in each year a window spans", () => {
    expect(
      read({ range: { from: "2026-10-20", until: "2027-10-21" }, scope: { kind: "mine" } }).map(
        (b) => b.date
      )
    ).toEqual(["2026-10-25"]);
    expect(
      read({ range: { from: "2026-10-20", until: "2027-10-26" }, scope: { kind: "mine" } }).map(
        (b) => [b.date, b.age]
      )
    ).toEqual([
      ["2026-10-25", 39],
      ["2027-10-25", 40],
    ]);
  });
});
