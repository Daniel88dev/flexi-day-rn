import { addDays, dateOfDay, dayNumber, dayOfDate, mondayIndex } from "../days";

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

describe("mondayIndex", () => {
  it("returns a day's place in a Monday-first week", () => {
    expect(mondayIndex("2026-09-21")).toBe(0);
    expect(mondayIndex("2026-09-27")).toBe(6);
    expect(mondayIndex("2027-01-01")).toBe(4);
    expect(mondayIndex("1970-01-01")).toBe(3);
    expect(mondayIndex("1969-12-29")).toBe(0);
  });
});

describe("dayOfDate", () => {
  it("returns the phone's calendar day of a moment", () => {
    expect(dayOfDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("dateOfDay", () => {
  it("returns a moment on that day that reads back as the same day, across a DST change", () => {
    expect(dayOfDate(dateOfDay("2026-03-29"))).toBe("2026-03-29");
    expect(dayOfDate(dateOfDay("2026-10-25"))).toBe("2026-10-25");
  });
});
