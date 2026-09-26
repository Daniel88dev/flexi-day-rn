import type { VacationStatus } from "@/lib/local-store";

import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

import { filterCounts, filterLabel, filterRuns } from "../filters";
import type { RequestRun } from "../runs";

const VIEWER = "viewer";

function run(id: string, status: VacationStatus, userId = "someone-else"): RequestRun {
  return {
    id,
    userId,
    userName: null,
    groupId: "group-1",
    groupName: null,
    vacationType: "VACATION",
    status,
    from: "2026-09-14",
    to: "2026-09-14",
    startTime: null,
    endTime: null,
    halfDay: false,
    vacationIds: [id],
    dayCount: 1,
    pending: false,
  };
}

const RUNS = [
  run("a", "pending", VIEWER),
  run("b", "pending"),
  run("c", "approved", VIEWER),
  run("d", "rejected"),
  run("e", "cancelled"),
  run("f", "approved"),
];

describe("filterCounts", () => {
  it("returns how many runs each chip would show", () => {
    expect(filterCounts(RUNS, VIEWER)).toEqual({
      all: 6,
      mine: 2,
      pending: 2,
      approved: 2,
      rejected: 1,
      cancelled: 1,
    });
  });

  it("returns zero for every chip over no runs", () => {
    expect(filterCounts([], VIEWER)).toEqual({
      all: 0,
      mine: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    });
  });

  it("returns no runs as mine while the viewer is unknown", () => {
    expect(filterCounts(RUNS, null).mine).toBe(0);
  });
});

describe("filterRuns", () => {
  it("returns every run for all", () => {
    expect(filterRuns(RUNS, "all", VIEWER)).toBe(RUNS);
  });

  it("returns the viewer's own runs for mine", () => {
    expect(filterRuns(RUNS, "mine", VIEWER).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("returns the runs of one status for a status chip", () => {
    expect(filterRuns(RUNS, "approved", VIEWER).map((r) => r.id)).toEqual(["c", "f"]);
  });
});

describe("filterLabel", () => {
  it("returns the chip's own label for all and mine", () => {
    expect(filterLabel("all", en)).toBe("All");
    expect(filterLabel("mine", cs)).toBe("Moje");
  });

  it("returns the status word for a status chip", () => {
    expect(filterLabel("rejected", en)).toBe(en.status.rejected);
  });
});
