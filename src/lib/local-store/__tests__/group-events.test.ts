import { applyPage } from "../apply";
import type { SyncEnvelope } from "../envelope";
import { calendarGroupEvents } from "../group-events";
import type { StoreRuntime } from "../runtime";
import {
  groupEventRow,
  groupRow,
  groupUserRow,
  syncPage,
  userRow,
} from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

const VIEWER = "me";
const OCTOBER = { from: "2026-10-01", until: "2026-11-01" };
const DELETED = "2026-10-02T08:00:00.000Z";

let store: StoreRuntime;

function apply(page: Partial<SyncEnvelope>) {
  store.write((transaction) => applyPage(transaction, syncPage(page), 1));
}

function read(query: Parameters<typeof calendarGroupEvents>[1]) {
  return calendarGroupEvents(store.getDatabase(), query);
}

const days = (events: { id: string; startDate: string }[]) =>
  events.map((event) => `${event.id}@${event.startDate}`);

beforeEach(async () => {
  store = await openTestStore(VIEWER);
  apply({
    users: [
      userRow({ id: VIEWER, name: "Dana Holt" }),
      userRow({ id: "eva", name: "Eva Novak" }),
      userRow({ id: "tom", name: "Tom Berg" }),
    ],
    groups: [
      groupRow({ id: "g-design", groupName: "Design", managerUserId: "eva" }),
      groupRow({ id: "g-platform", groupName: "Platform", managerUserId: "tom" }),
      groupRow({ id: "g-other", groupName: "Other", managerUserId: "tom" }),
    ],
    groupUsers: [
      groupUserRow({ id: "gu-1", groupId: "g-design", userId: VIEWER }),
      groupUserRow({ id: "gu-2", groupId: "g-platform", userId: VIEWER, adminAccess: true }),
      groupUserRow({ id: "gu-3", groupId: "g-design", userId: "eva" }),
      groupUserRow({ id: "gu-4", groupId: "g-platform", userId: "tom" }),
    ],
    groupEvents: [
      groupEventRow({
        id: "standup",
        groupId: "g-design",
        createdByUserId: "eva",
        skippedDates: ["2026-10-19"],
      }),
      groupEventRow({
        id: "offsite",
        groupId: "g-platform",
        createdByUserId: "tom",
        title: "Team offsite",
        note: "Bring boots",
        startDate: "2026-10-21",
        endDate: "2026-10-23",
        startTime: null,
        endTime: null,
        repeatFreq: null,
        repeatInterval: null,
        repeatWeekdays: null,
      }),
      groupEventRow({
        id: "stray",
        groupId: "g-other",
        createdByUserId: "tom",
        startDate: "2026-10-06",
        endDate: "2026-10-06",
        repeatFreq: null,
        repeatInterval: null,
        repeatWeekdays: null,
      }),
    ],
  });
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

describe("calendarGroupEvents", () => {
  it("returns each occurrence of the viewer's groups' events in Mine scope, skipped dates left out", () => {
    expect(days(read({ range: OCTOBER, scope: { kind: "mine" } }))).toEqual([
      "standup@2026-10-05",
      "standup@2026-10-12",
      "offsite@2026-10-21",
      "standup@2026-10-26",
    ]);
  });

  it("returns only the chosen group's events in Group scope", () => {
    expect(days(read({ range: OCTOBER, scope: { kind: "group", groupId: "g-platform" } }))).toEqual(
      ["offsite@2026-10-21"]
    );
  });

  it("returns an event's group, creator, times, rule and note", () => {
    const [standup] = read({
      range: { from: "2026-10-05", until: "2026-10-06" },
      scope: { kind: "mine" },
    });
    expect(standup).toEqual({
      id: "standup",
      groupId: "g-design",
      groupName: "Design",
      title: "Weekly standup",
      note: null,
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      startTime: "09:30",
      endTime: "09:45",
      ruleStartDate: "2026-10-05",
      repeat: { freq: "weekly", interval: 1, weekdays: [0], monthlyMode: null, until: null },
      changedOnce: false,
      creator: { id: "eva", name: "Eva Novak" },
    });
  });

  it("returns a multi-day one-off once with its whole span", () => {
    const events = read({
      range: { from: "2026-10-22", until: "2026-10-23" },
      scope: { kind: "mine" },
    });
    expect(events).toEqual([
      expect.objectContaining({
        id: "offsite",
        startDate: "2026-10-21",
        endDate: "2026-10-23",
        note: "Bring boots",
        repeat: null,
      }),
    ]);
  });

  it("names no creator once the creator's account is gone", () => {
    apply({
      groupEvents: [groupEventRow({ id: "standup", groupId: "g-design", createdByUserId: null })],
    });
    expect(read({ range: OCTOBER, scope: { kind: "mine" } })[0].creator).toBeNull();
  });

  it("marks a one-off made from one occurrence as changed for that date", () => {
    apply({
      groupEvents: [
        groupEventRow({
          id: "moved",
          groupId: "g-design",
          startDate: "2026-10-20",
          endDate: "2026-10-20",
          repeatFreq: null,
          repeatInterval: null,
          repeatWeekdays: null,
          recurringEventId: "standup",
          originalDate: "2026-10-19",
        }),
      ],
    });
    expect(
      read({ range: { from: "2026-10-19", until: "2026-10-21" }, scope: { kind: "mine" } })
    ).toEqual([expect.objectContaining({ id: "moved", changedOnce: true })]);
  });

  it("returns nothing for a group the viewer left", () => {
    apply({
      groupUsers: [
        groupUserRow({ id: "gu-1", groupId: "g-design", userId: VIEWER, deletedAt: DELETED }),
      ],
    });
    expect(days(read({ range: OCTOBER, scope: { kind: "mine" } }))).toEqual(["offsite@2026-10-21"]);
  });

  it("returns nothing once a tombstone arrives", () => {
    apply({
      groupEvents: [
        groupEventRow({ id: "offsite", groupId: "g-platform", title: null, deletedAt: DELETED }),
      ],
    });
    expect(days(read({ range: OCTOBER, scope: { kind: "group", groupId: "g-platform" } }))).toEqual(
      []
    );
  });
});
