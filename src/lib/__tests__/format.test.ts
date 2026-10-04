import { clockTime, dayAndMonth } from "@/lib/format";

describe("clockTime", () => {
  it("returns the hour and minute in the dictionary's locale", () => {
    const at = new Date(2026, 9, 4, 9, 41).getTime();
    expect(clockTime("en-GB", at)).toBe("09:41");
    expect(clockTime("cs-CZ", at)).toBe("09:41");
  });
});

describe("dayAndMonth", () => {
  it("returns the day and the month's name in the dictionary's locale", () => {
    const at = new Date(2026, 9, 17, 11, 30).toISOString();
    expect(dayAndMonth("en-GB", at)).toBe("17 October");
    expect(dayAndMonth("cs-CZ", at)).toBe("17. října");
  });

  it("returns the day on the device's clock, not the server's", () => {
    expect(dayAndMonth("en-GB", new Date(2026, 9, 17, 0, 5).toISOString())).toBe("17 October");
    expect(dayAndMonth("en-GB", new Date(2026, 9, 16, 23, 55).toISOString())).toBe("16 October");
  });
});
