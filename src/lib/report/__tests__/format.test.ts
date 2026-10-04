import { formatDays, formatKeptAt } from "../format";

describe("formatDays", () => {
  it("returns a whole number bare", () => {
    expect(formatDays(18, ".")).toBe("18");
    expect(formatDays(0, ",")).toBe("0");
  });

  it("returns a half day with one decimal and a dot in English", () => {
    expect(formatDays(27.5, ".")).toBe("27.5");
    expect(formatDays(0.5, ".")).toBe("0.5");
  });

  it("returns a half day with one decimal and a comma in Czech", () => {
    expect(formatDays(27.5, ",")).toBe("27,5");
  });

  it("returns an overdraft with its minus sign", () => {
    expect(formatDays(-1.5, ".")).toBe("-1.5");
    expect(formatDays(-1.5, ",")).toBe("-1,5");
  });

  it("returns a value with float noise rounded to one decimal", () => {
    expect(formatDays(0.1 + 0.2, ".")).toBe("0.3");
    expect(formatDays(2.9999999, ".")).toBe("3");
  });
});

describe("formatKeptAt", () => {
  const today = new Date(2026, 9, 4, 10);

  it("returns the time alone for an answer from today", () => {
    expect(formatKeptAt(new Date(2026, 9, 4, 9, 5), today, "en-GB", true)).toBe("09:05");
    expect(formatKeptAt(new Date(2026, 9, 4, 18, 5), today, "cs-CZ", true)).toBe("18:05");
  });

  it("returns the date in front of the time for an answer from another day", () => {
    expect(formatKeptAt(new Date(2026, 9, 3, 18, 5), today, "en-GB", true)).toBe("3 Oct, 18:05");
    expect(formatKeptAt(new Date(2026, 9, 3, 18, 5), today, "cs-CZ", true)).toBe("3. 10. 18:05");
  });

  it("returns a twelve-hour time when the device uses one", () => {
    expect(formatKeptAt(new Date(2026, 9, 4, 18, 5), today, "en-GB", false)).toBe("6:05 pm");
  });
});
