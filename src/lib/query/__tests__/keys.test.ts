import { qk } from "@/lib/query/keys";

// The expected keys are copied from the web's `qk` in flexi-day/lib/api/queries.ts.
describe("qk", () => {
  it("returns the web's attendance keys, reading an absent organization as its own", () => {
    expect(qk.attendanceState()).toEqual(["attendance-state", "own"]);
    expect(qk.attendanceState("org-1")).toEqual(["attendance-state", "org-1"]);
    expect(qk.attendanceMonth(2026, 9)).toEqual(["attendance-month", 2026, 9, "own"]);
    expect(qk.attendanceDay({ organizationId: "org-1", businessDate: "2026-09-26" })).toEqual([
      "attendance-day",
      "org-1",
      "2026-09-26",
      "own",
    ]);
  });

  it("returns the web's keys for approvals, the dashboard summary, request detail, group access and members, settings and notifications", () => {
    expect(qk.myApprovals()).toEqual(["my-approvals"]);
    expect(qk.dashboardSummary()).toEqual(["dashboard-summary"]);
    expect(qk.vacation("vacation-1")).toEqual(["vacation", "vacation-1"]);
    expect(qk.vacationDetails()).toEqual(["vacation"]);
    expect(qk.group("group-1")).toEqual(["group", "group-1"]);
    expect(qk.groupUsers("group-1")).toEqual(["group-users", "group-1"]);
    expect(qk.mySettings()).toEqual(["my-settings"]);
    expect(qk.notifications(true)).toEqual(["notifications", true]);
    expect(qk.allNotifications()).toEqual(["notifications"]);
    expect(qk.authAccounts()).toEqual(["auth", "accounts"]);
  });

  it("returns the web's key for the holiday countries", () => {
    expect(qk.bankHolidayCountries()).toEqual(["bank-holiday-countries"]);
  });

  it("returns the web's key for a group's quotas, every member's unless one is named", () => {
    expect(qk.quotas("group-1", 2026)).toEqual(["quotas", "group-1", 2026, "all"]);
    expect(qk.quotas("group-1", 2026, "user-2")).toEqual(["quotas", "group-1", 2026, "user-2"]);
  });
});
