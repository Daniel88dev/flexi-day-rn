import { applyPage } from "../apply";
import { balanceBuckets } from "../balance";
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

const VIEWER = "user-1";
const APPROVED = "2026-03-01T09:00:00.000Z";
const REJECTED = "2026-03-02T09:00:00.000Z";
const CANCELLED = "2026-03-03T09:00:00.000Z";

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore(VIEWER);
  pullIn({
    groups: [groupRow({ id: "group-1" }), groupRow({ id: "group-2", holidayCountry: null })],
    groupUsers: [
      groupUserRow({ id: "member-1", groupId: "group-1", userId: VIEWER }),
      groupUserRow({ id: "member-2", groupId: "group-2", userId: VIEWER }),
    ],
  });
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function pullIn(page: Partial<SyncEnvelope>) {
  store.write((transaction) => applyPage(transaction, syncPage(page), 1));
}

const buckets = (year = 2026) => balanceBuckets(store.getDatabase(), [], year);

const bucket = (type: string, year = 2026) => buckets(year).find((entry) => entry.type === type);

let day = 0;
/** A booking of the viewer's in group-1 on its own day of March 2026. */
function booking(patch: Parameters<typeof vacationRow>[0] = {}) {
  day += 1;
  return vacationRow({
    id: `vacation-${day}`,
    requestedDay: `2026-03-${String(day).padStart(2, "0")}`,
    ...patch,
  });
}

beforeEach(() => {
  day = 0;
});

describe("balanceBuckets", () => {
  it("returns nothing allocated for a year without quotas", () => {
    expect(buckets()).toEqual([
      { type: "VACATION", allocated: 0, used: 0, pending: 0 },
      { type: "HOME_OFFICE", allocated: 0, used: 0, pending: 0 },
    ]);
  });

  it("returns the allowances summed across the viewer's groups, carry-over on vacation only", () => {
    pullIn({
      userYearQuotas: [
        userYearQuotaRow({ id: "q1", groupId: "group-1", vacationDays: 20, carriedOverDays: 3 }),
        userYearQuotaRow({ id: "q2", groupId: "group-2", vacationDays: 5, homeOfficeDays: 4 }),
      ],
    });

    expect(buckets()).toEqual([
      { type: "VACATION", allocated: 28, used: 0, pending: 0 },
      { type: "HOME_OFFICE", allocated: 14, used: 0, pending: 0 },
      { type: "SICK_DAY", allocated: 10, used: 0, pending: 0 },
    ]);
  });

  it("returns no sick day bucket while nothing allocates sick days", () => {
    pullIn({ userYearQuotas: [userYearQuotaRow({ sickDays: 0 })] });

    expect(bucket("SICK_DAY")).toBeUndefined();
  });

  it("returns only the year asked for", () => {
    pullIn({
      userYearQuotas: [
        userYearQuotaRow({ id: "q-2026", relatedYear: "2026", vacationDays: 25 }),
        userYearQuotaRow({ id: "q-2027", relatedYear: "2027", vacationDays: 30 }),
      ],
      vacations: [booking({ approvedAt: APPROVED }), booking({ requestedDay: "2027-01-04" })],
    });

    expect(bucket("VACATION", 2026)).toMatchObject({ allocated: 25, used: 1, pending: 0 });
    expect(bucket("VACATION", 2027)).toMatchObject({ allocated: 30, used: 0, pending: 1 });
  });

  it("returns nothing of a group the viewer no longer belongs to", () => {
    pullIn({
      groups: [groupRow({ id: "group-old" })],
      groupUsers: [groupUserRow({ id: "member-old", groupId: "group-old", userId: VIEWER })],
    });
    pullIn({
      groupUsers: [
        groupUserRow({
          id: "member-old",
          groupId: "group-old",
          userId: VIEWER,
          deletedAt: CANCELLED,
        }),
      ],
      userYearQuotas: [userYearQuotaRow({ groupId: "group-old", vacationDays: 12 })],
      vacations: [booking({ groupId: "group-old", approvedAt: APPROVED })],
    });

    expect(bucket("VACATION")).toMatchObject({ allocated: 0, used: 0 });
  });

  it("returns nothing of another member's quotas or bookings", () => {
    pullIn({
      userYearQuotas: [userYearQuotaRow({ userId: "user-2", vacationDays: 25 })],
      vacations: [booking({ userId: "user-2", approvedAt: APPROVED })],
    });

    expect(bucket("VACATION")).toMatchObject({ allocated: 0, used: 0 });
  });

  it("returns approved days as used and undecided days as pending, a half day as 0.5", () => {
    pullIn({
      userYearQuotas: [userYearQuotaRow({ vacationDays: 25 })],
      vacations: [
        booking({ approvedAt: APPROVED }),
        booking({ approvedAt: APPROVED, halfDay: true }),
        booking(),
        booking({ halfDay: true }),
      ],
    });

    expect(bucket("VACATION")).toEqual({
      type: "VACATION",
      allocated: 25,
      used: 1.5,
      pending: 1.5,
    });
  });

  it("returns rejected and cancelled days as neither used nor pending", () => {
    pullIn({
      userYearQuotas: [userYearQuotaRow()],
      vacations: [
        booking({ rejectedAt: REJECTED }),
        booking({ deletedAt: CANCELLED }),
        booking({ approvedAt: APPROVED, deletedAt: CANCELLED }),
      ],
    });

    expect(bucket("VACATION")).toMatchObject({ used: 0, pending: 0 });
  });

  it("returns a bucket for a type booked without an allowance", () => {
    pullIn({ vacations: [booking({ vacationType: "SICK", approvedAt: APPROVED })] });

    expect(bucket("SICK")).toEqual({ type: "SICK", allocated: 0, used: 1, pending: 0 });
  });

  it("returns a booking in flight as pending", () => {
    pullIn({ userYearQuotas: [userYearQuotaRow()] });
    const change = activePendingChanges().add({
      kind: "create",
      draft: { groupId: "group-2", from: "2026-03-16", to: "2026-03-17" },
    });

    const withChange = balanceBuckets(store.getDatabase(), [change], 2026);

    expect(withChange.find((entry) => entry.type === "VACATION")).toMatchObject({ pending: 2 });
  });
});
