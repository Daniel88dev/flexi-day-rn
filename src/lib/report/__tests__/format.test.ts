import { formatDays } from "../format";

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
