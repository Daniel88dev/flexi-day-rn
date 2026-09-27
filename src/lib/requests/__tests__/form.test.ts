import { requestableTypes } from "../form";

describe("requestableTypes", () => {
  it("returns the everyday types, then the others without Sick day", () => {
    expect(requestableTypes({ offerSickDay: false })).toEqual({
      primary: ["VACATION", "HOME_OFFICE", "SICK"],
      others: ["PAID_TIME_OFF", "NON_PAID_LEAVE", "STUDY_LEAVE", "OTHER"],
    });
  });

  it("returns Sick day among the others while the benefit is active", () => {
    expect(requestableTypes({ offerSickDay: true }).others[0]).toBe("SICK_DAY");
  });

  it("returns the request's own type even when it is no longer offered", () => {
    expect(requestableTypes({ offerSickDay: false, current: "SICK_DAY" }).others).toContain(
      "SICK_DAY"
    );
  });
});
