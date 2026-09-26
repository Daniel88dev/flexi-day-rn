import type { ListedVacation } from "@/lib/local-store";

import { collapseRuns } from "../runs";

const STAMP = "2026-09-01T09:00:00.000Z";

function day(overrides: Partial<ListedVacation> & { id: string; requestedDay: string }) {
  const row: ListedVacation = {
    userId: "user-1",
    groupId: "group-1",
    organizationId: "org-1",
    requestId: "request-1",
    startTime: null,
    endTime: null,
    vacationType: "VACATION",
    halfDay: false,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    note: null,
    createdByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    status: "pending",
    pending: false,
    actionsDisabled: false,
    userName: "Dana Kučerová",
    groupName: "Engineering",
    ...overrides,
  };
  return row;
}

describe("collapseRuns", () => {
  it("returns one run for contiguous days of the same booking", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14" }),
      day({ id: "b", requestedDay: "2026-09-15" }),
      day({ id: "c", requestedDay: "2026-09-16" }),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: "a",
      from: "2026-09-14",
      to: "2026-09-16",
      dayCount: 3,
      vacationIds: ["a", "b", "c"],
      userName: "Dana Kučerová",
      groupName: "Engineering",
    });
  });

  it("returns a half day apart from the full day beside it", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14" }),
      day({ id: "b", requestedDay: "2026-09-15", halfDay: true }),
    ]);

    expect(runs.map((run) => run.halfDay)).toEqual([false, true]);
  });

  it("returns a run of half days as one run", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14", halfDay: true }),
      day({ id: "b", requestedDay: "2026-09-15", halfDay: true }),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ halfDay: true, dayCount: 2 });
  });

  it("returns two runs across a calendar gap", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14" }),
      day({ id: "b", requestedDay: "2026-09-15" }),
      day({ id: "c", requestedDay: "2026-09-17" }),
    ]);

    expect(runs.map((run) => [run.from, run.to])).toEqual([
      ["2026-09-14", "2026-09-15"],
      ["2026-09-17", "2026-09-17"],
    ]);
  });

  it("returns a run per status, so a partly approved Request splits", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14", status: "approved" }),
      day({ id: "b", requestedDay: "2026-09-15", status: "pending" }),
    ]);

    expect(runs.map((run) => run.status)).toEqual(["approved", "pending"]);
  });

  it("returns a run per type on adjacent days", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14", vacationType: "VACATION" }),
      day({ id: "b", requestedDay: "2026-09-15", vacationType: "HOME_OFFICE" }),
    ]);

    expect(runs).toHaveLength(2);
  });

  it("returns a run per set of times on adjacent days", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14", startTime: "08:00", endTime: "12:00" }),
      day({ id: "b", requestedDay: "2026-09-15" }),
    ]);

    expect(runs).toHaveLength(2);
  });

  it("returns a run per person on adjacent days", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14", userId: "user-1" }),
      day({ id: "b", requestedDay: "2026-09-15", userId: "user-2", userName: "Eva Horáková" }),
    ]);

    expect(runs.map((run) => [run.userName, run.dayCount])).toEqual([
      ["Dana Kučerová", 1],
      ["Eva Horáková", 1],
    ]);
  });

  it("returns a run per group on adjacent days", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14", groupId: "group-1" }),
      day({ id: "b", requestedDay: "2026-09-15", groupId: "group-2" }),
    ]);

    expect(runs).toHaveLength(2);
  });

  it("returns one run across two Requests on adjacent days, ignoring requestId", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14", requestId: "request-1" }),
      day({ id: "b", requestedDay: "2026-09-15", requestId: "request-2" }),
    ]);

    expect(runs).toHaveLength(1);
  });

  it("returns a pending run when a change holds any one of its days", () => {
    const runs = collapseRuns([
      day({ id: "a", requestedDay: "2026-09-14" }),
      day({ id: "b", requestedDay: "2026-09-15", pending: true, actionsDisabled: true }),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0].pending).toBe(true);
  });

  it("returns runs ordered by their first day, whatever order the rows came in", () => {
    const runs = collapseRuns([
      day({ id: "late", requestedDay: "2026-09-21", userId: "user-0" }),
      day({ id: "early", requestedDay: "2026-09-02", userId: "user-9" }),
    ]);

    expect(runs.map((run) => run.id)).toEqual(["early", "late"]);
  });

  it("returns nothing for no rows", () => {
    expect(collapseRuns([])).toEqual([]);
  });
});
