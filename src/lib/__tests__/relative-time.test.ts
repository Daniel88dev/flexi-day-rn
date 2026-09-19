import { ageMs, roughAge } from "../relative-time";

const NOW = Date.parse("2026-09-19T12:00:00.000Z");

describe("ageMs", () => {
  it("returns the distance from a stamp to the time it is read at", () => {
    expect(ageMs("2026-09-19T11:58:00.000Z", NOW)).toBe(2 * 60_000);
    expect(ageMs("2026-09-19T12:00:00.000Z", NOW)).toBe(0);
  });
});

describe("roughAge", () => {
  it("returns the roughest unit that still says something", () => {
    expect(roughAge(12_000)).toEqual({ unit: "seconds", value: 12 });
    expect(roughAge(90_000)).toEqual({ unit: "minutes", value: 1 });
    expect(roughAge(3 * 60 * 60_000)).toEqual({ unit: "hours", value: 3 });
    expect(roughAge(50 * 60 * 60_000)).toEqual({ unit: "days", value: 2 });
  });

  it("returns no negative seconds for a stamp the clock is behind", () => {
    expect(roughAge(-5_000)).toEqual({ unit: "seconds", value: 0 });
  });
});
