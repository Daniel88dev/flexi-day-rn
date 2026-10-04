import { clockTime } from "@/lib/format";

describe("clockTime", () => {
  it("returns the hour and minute in the dictionary's locale", () => {
    const at = new Date(2026, 9, 4, 9, 41).getTime();
    expect(clockTime("en-GB", at)).toBe("09:41");
    expect(clockTime("cs-CZ", at)).toBe("09:41");
  });
});
