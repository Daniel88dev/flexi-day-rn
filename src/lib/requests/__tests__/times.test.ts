import { dateOfTime, timeOfDate } from "../times";

describe("dateOfTime", () => {
  it("returns a date on the given day at that hour and minute", () => {
    const date = dateOfTime("08:30", new Date(2026, 8, 21, 17, 45));
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 8, 21]);
    expect([date.getHours(), date.getMinutes()]).toEqual([8, 30]);
  });
});

describe("timeOfDate", () => {
  it("returns the hour and minute as HH:MM", () => {
    expect(timeOfDate(new Date(2026, 8, 21, 7, 5))).toBe("07:05");
  });
});
