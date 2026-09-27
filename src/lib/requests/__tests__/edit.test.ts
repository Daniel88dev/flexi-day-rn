import { vacationDetail } from "@/test-support/vacation-detail";

import { canSaveEdit, editPatch, editValuesOf, requestableTypes, type EditValues } from "../edit";

describe("editValuesOf", () => {
  it("returns the detail's fields, times to the minute and no note as empty", () => {
    expect(
      editValuesOf(
        vacationDetail({ vacationType: "HOME_OFFICE", startTime: "08:00:00", endTime: "12:30:00" })
      )
    ).toEqual({
      vacationType: "HOME_OFFICE",
      startTime: "08:00",
      endTime: "12:30",
      halfDay: false,
      note: "",
    });
  });
});

describe("editPatch", () => {
  const detail = vacationDetail({ note: "Trip", startTime: "08:00:00", endTime: "12:00:00" });
  const values = editValuesOf(detail);

  it("returns nothing when nothing changed", () => {
    expect(editPatch(detail, values)).toEqual({});
  });

  it("returns only the fields that changed, the note trimmed", () => {
    expect(editPatch(detail, { ...values, vacationType: "SICK", note: "  Flu  " })).toEqual({
      vacationType: "SICK",
      note: "Flu",
    });
  });

  it("returns both times when either moves, so the server checks the pair", () => {
    expect(editPatch(detail, { ...values, endTime: "13:00" })).toEqual({
      startTime: "08:00",
      endTime: "13:00",
    });
  });

  it("returns cleared times and a cleared note as null", () => {
    expect(editPatch(detail, { ...values, startTime: "", endTime: "", note: " " })).toEqual({
      startTime: null,
      endTime: null,
      note: null,
    });
  });

  it("returns half day only for a single day", () => {
    const run = vacationDetail({
      rangeEnd: "2026-09-22",
      vacationIds: ["vacation-1", "vacation-2"],
    });
    expect(editPatch(run, { ...editValuesOf(run), halfDay: true })).toEqual({});
    expect(editPatch(detail, { ...values, halfDay: true })).toEqual({ halfDay: true });
  });
});

describe("canSaveEdit", () => {
  const values: EditValues = {
    vacationType: "VACATION",
    startTime: "",
    endTime: "",
    halfDay: false,
    note: "",
  };

  it("returns true for a type and no times", () => {
    expect(canSaveEdit(values)).toBe(true);
  });

  it("returns false while Others is open with no type picked", () => {
    expect(canSaveEdit({ ...values, vacationType: null })).toBe(false);
  });

  it("returns false for Other without a note", () => {
    expect(canSaveEdit({ ...values, vacationType: "OTHER", note: "  " })).toBe(false);
    expect(canSaveEdit({ ...values, vacationType: "OTHER", note: "Moving house" })).toBe(true);
  });

  it("returns false for an end time that is not after the start", () => {
    expect(canSaveEdit({ ...values, startTime: "13:00", endTime: "12:00" })).toBe(false);
    expect(canSaveEdit({ ...values, startTime: "08:00", endTime: "12:00" })).toBe(true);
  });
});

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
