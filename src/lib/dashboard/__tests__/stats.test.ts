import { statTiles } from "../stats";

const READY = {
  state: "ready",
  summary: {
    pendingApprovalsCount: 0,
    outTodayCount: 3,
    workingTodayCount: 5,
    upcomingNext14DaysCount: 4,
    teamSize: 8,
  },
} as const;

describe("statTiles", () => {
  it("returns Out today, Coming up and Working today for an employee", () => {
    expect(statTiles(READY, { approver: false })).toEqual([
      { id: "outToday", value: 3, linksToRequests: false },
      { id: "comingUp", value: 4, linksToRequests: true },
      { id: "workingToday", value: 5, linksToRequests: false },
    ]);
  });

  it("returns Pending first for an approver, even at zero", () => {
    expect(statTiles(READY, { approver: true })).toEqual([
      { id: "pending", value: 0, linksToRequests: true },
      { id: "outToday", value: 3, linksToRequests: false },
      { id: "comingUp", value: 4, linksToRequests: true },
      { id: "workingToday", value: 5, linksToRequests: false },
    ]);
  });

  it("returns every tile as loading until the first answer arrives", () => {
    expect(statTiles({ state: "loading" }, { approver: true }).map((tile) => tile.value)).toEqual([
      "loading",
      "loading",
      "loading",
      "loading",
    ]);
  });

  it("returns every tile as unavailable once the latest read failed", () => {
    expect(statTiles({ state: "failed" }, { approver: false }).map((tile) => tile.value)).toEqual([
      "unavailable",
      "unavailable",
      "unavailable",
    ]);
  });
});
