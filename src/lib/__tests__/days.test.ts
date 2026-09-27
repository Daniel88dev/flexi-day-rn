import { addDays, dayNumber } from "../days";

describe("dayNumber", () => {
  it("returns consecutive numbers for consecutive days, across a month and a DST change", () => {
    expect(dayNumber("2026-11-01") - dayNumber("2026-10-31")).toBe(1);
    expect(dayNumber("2026-03-30") - dayNumber("2026-03-29")).toBe(1);
  });
});

describe("addDays", () => {
  it("returns the ISO day that many days away, either way, across years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-14", -62)).toBe("2026-08-13");
  });
});
