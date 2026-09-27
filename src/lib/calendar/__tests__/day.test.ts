import type { ListedVacation } from "@/lib/local-store";

import { dayEntries, dayParts, dayWindow, openingDay } from "../day";

function row(patch: Partial<ListedVacation> & Pick<ListedVacation, "id" | "requestedDay">) {
  return {
    userId: "u-eva",
    userName: "Eva Horakova",
    groupId: "g1",
    groupName: "Design",
    organizationId: "o1",
    requestId: `r-${patch.id}`,
    startTime: null,
    endTime: null,
    vacationType: "VACATION",
    halfDay: false,
    approvedAt: "2026-10-01",
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    note: null,
    createdByUserId: null,
    deletedAt: null,
    deletedByUserId: null,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
    status: "approved",
    pending: false,
    actionsDisabled: false,
    ...patch,
  } satisfies ListedVacation;
}

describe("dayEntries", () => {
  it("returns everyone on the day, the viewer first, then by name", () => {
    const entries = dayEntries(
      [
        row({ id: "t", userId: "u-tom", userName: "Tomas", requestedDay: "2026-10-14" }),
        row({ id: "a", userId: "u-ada", userName: "Ada", requestedDay: "2026-10-14" }),
        row({ id: "me", userId: "me", userName: "Dana", requestedDay: "2026-10-14" }),
        row({ id: "x", userId: "u-ada", userName: "Ada", requestedDay: "2026-10-15" }),
      ],
      "2026-10-14",
      "me"
    );

    expect(entries.map((entry) => entry.vacationId)).toEqual(["me", "a", "t"]);
  });

  it("returns the span of the request the day belongs to", () => {
    const entries = dayEntries(
      [
        row({ id: "d1", requestId: "r1", requestedDay: "2026-10-12" }),
        row({ id: "d2", requestId: "r1", requestedDay: "2026-10-14" }),
        row({ id: "d3", requestId: "r1", requestedDay: "2026-10-19" }),
        row({ id: "other", requestId: "r2", requestedDay: "2026-10-21" }),
      ],
      "2026-10-14",
      "me"
    );

    expect(entries).toEqual([
      expect.objectContaining({ vacationId: "d2", from: "2026-10-12", to: "2026-10-19" }),
    ]);
  });

  it("returns the span of the days sharing the row's status when a request was partly decided", () => {
    const entries = dayEntries(
      [
        row({ id: "d1", requestId: "r1", requestedDay: "2026-10-12" }),
        row({ id: "d2", requestId: "r1", requestedDay: "2026-10-13", status: "pending" }),
        row({ id: "d3", requestId: "r1", requestedDay: "2026-10-14", status: "pending" }),
      ],
      "2026-10-14",
      "me"
    );

    expect(entries).toEqual([
      expect.objectContaining({ status: "pending", from: "2026-10-13", to: "2026-10-14" }),
    ]);
  });

  it("returns an entry as pending while a change or a Provisional row holds it", () => {
    const [entry] = dayEntries(
      [row({ id: "pending-1:2026-10-14", requestedDay: "2026-10-14", pending: true })],
      "2026-10-14",
      null
    );

    expect(entry.pending).toBe(true);
  });

  it("returns the type, status and half day of each entry", () => {
    const [entry] = dayEntries(
      [
        row({
          id: "h",
          requestedDay: "2026-10-14",
          vacationType: "HOME_OFFICE",
          status: "pending",
          halfDay: true,
        }),
      ],
      "2026-10-14",
      null
    );

    expect(entry).toMatchObject({
      userId: "u-eva",
      userName: "Eva Horakova",
      type: "HOME_OFFICE",
      status: "pending",
      halfDay: true,
    });
  });
});

describe("dayWindow", () => {
  it("returns about two months either side of the day, across month and year ends", () => {
    expect(dayWindow("2026-10-14")).toEqual({ from: "2026-08-13", until: "2026-12-16" });
    expect(dayWindow("2026-12-31")).toEqual({ from: "2026-10-30", until: "2027-03-04" });
  });
});

describe("dayParts", () => {
  it("returns the Monday-first weekday and the day and month of an ISO date", () => {
    expect(dayParts("2026-10-14")).toEqual({ weekday: 2, date: { day: 14, month: 10 } });
    expect(dayParts("2026-10-18")).toEqual({ weekday: 6, date: { day: 18, month: 10 } });
  });
});

describe("openingDay", () => {
  it("returns today when the month holds it", () => {
    expect(openingDay({ year: 2026, month: 10 }, "2026-10-14")).toBe("2026-10-14");
  });

  it("returns the 1st of any other month", () => {
    expect(openingDay({ year: 2026, month: 11 }, "2026-10-14")).toBe("2026-11-01");
    expect(openingDay({ year: 2025, month: 10 }, "2026-10-14")).toBe("2025-10-01");
  });
});
