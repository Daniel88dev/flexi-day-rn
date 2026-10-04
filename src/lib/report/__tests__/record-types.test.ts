import { activeRecordTypes } from "../record-types";
import type { ReportSummaryRow } from "../types";

function line(vacationType: ReportSummaryRow["vacationType"], userId = "u-1"): ReportSummaryRow {
  return {
    userId,
    groupId: "g-1",
    vacationType,
    carriedOverDays: 0,
    yearQuota: 0,
    usedToDate: 0,
    plannedRemaining: 0,
    pending: 0,
    remaining: 0,
  };
}

describe("activeRecordTypes", () => {
  it("returns Vacation, Home office, Sick day, Sick and Paid time off in that order, whatever order the summary has", () => {
    expect(
      activeRecordTypes([
        line("PAID_TIME_OFF"),
        line("SICK"),
        line("SICK_DAY"),
        line("HOME_OFFICE"),
        line("VACATION"),
      ])
    ).toEqual(["VACATION", "HOME_OFFICE", "SICK_DAY", "SICK", "PAID_TIME_OFF"]);
  });

  it("returns the other types after those, in the order the summary first lists them", () => {
    expect(
      activeRecordTypes([
        line("STUDY_LEAVE"),
        line("OTHER"),
        line("HOME_OFFICE"),
        line("NON_PAID_LEAVE"),
      ])
    ).toEqual(["HOME_OFFICE", "STUDY_LEAVE", "OTHER", "NON_PAID_LEAVE"]);
  });

  it("returns each type once however many people carry it", () => {
    expect(activeRecordTypes([line("VACATION", "u-1"), line("VACATION", "u-2")])).toEqual([
      "VACATION",
    ]);
  });

  it("returns Vacation for an empty summary", () => {
    expect(activeRecordTypes([])).toEqual(["VACATION"]);
  });
});
