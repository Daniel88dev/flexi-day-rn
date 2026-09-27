import { linkedDay, stepDay } from "../day-anchor";

const TODAY = "2026-09-27";

describe("linkedDay", () => {
  it("returns the linked day when it has already begun", () => {
    expect(linkedDay("2026-09-20", TODAY)).toBe("2026-09-20");
    expect(linkedDay(TODAY, TODAY)).toBe(TODAY);
  });

  it("returns today for a day still to come", () => {
    expect(linkedDay("2026-09-28", TODAY)).toBe(TODAY);
  });

  it("returns today for a malformed or impossible day", () => {
    expect(linkedDay("27.9.2026", TODAY)).toBe(TODAY);
    expect(linkedDay("2026-9-1", TODAY)).toBe(TODAY);
    expect(linkedDay("2026-02-30", TODAY)).toBe(TODAY);
    expect(linkedDay("2026-13-45", TODAY)).toBe(TODAY);
    expect(linkedDay("", TODAY)).toBe(TODAY);
  });

  it("returns today without a link", () => {
    expect(linkedDay(null, TODAY)).toBe(TODAY);
    expect(linkedDay(undefined, TODAY)).toBe(TODAY);
  });
});

describe("stepDay", () => {
  it("returns the day before or after", () => {
    expect(stepDay("2026-09-01", -1, TODAY)).toBe("2026-08-31");
    expect(stepDay("2026-09-20", 1, TODAY)).toBe("2026-09-21");
  });

  it("returns null past today, so the stepper never reaches a day still to come", () => {
    expect(stepDay(TODAY, 1, TODAY)).toBeNull();
  });
});
