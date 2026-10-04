import { holidayCountryLabel, weekdayPills, workingDayRuns } from "@/lib/groups/facts";

describe("weekdayPills", () => {
  it("returns Monday to Sunday with the working ones on", () => {
    expect(weekdayPills([1, 2, 3, 4, 5]).map(({ working }) => working)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it("returns Sunday last, from its getDay number 0", () => {
    expect(weekdayPills([0]).map(({ weekday }) => weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayPills([0]).at(-1)).toEqual({ weekday: 0, working: true });
  });
});

describe("workingDayRuns", () => {
  it("returns one run for a working week", () => {
    expect(workingDayRuns([1, 2, 3, 4, 5])).toEqual([{ from: 0, to: 4 }]);
  });

  it("returns single days apart and in week order whatever the input order", () => {
    expect(workingDayRuns([5, 1, 3])).toEqual([
      { from: 0, to: 0 },
      { from: 2, to: 2 },
      { from: 4, to: 4 },
    ]);
  });

  it("returns a run ending on Sunday without wrapping to Monday", () => {
    expect(workingDayRuns([0, 1, 5, 6])).toEqual([
      { from: 0, to: 0 },
      { from: 4, to: 6 },
    ]);
  });

  it("returns the whole week as one run", () => {
    expect(workingDayRuns([0, 1, 2, 3, 4, 5, 6])).toEqual([{ from: 0, to: 6 }]);
  });

  it("returns no runs for no working days", () => {
    expect(workingDayRuns([])).toEqual([]);
  });
});

describe("holidayCountryLabel", () => {
  const countries = [{ code: "CZ", name: "Czechia" }];

  it("returns the country's name once the countries have answered", () => {
    expect(holidayCountryLabel("CZ", countries)).toBe("Czechia");
  });

  it("returns the code until the countries answer", () => {
    expect(holidayCountryLabel("CZ", undefined)).toBe("CZ");
  });

  it("returns the code for a country the list lacks", () => {
    expect(holidayCountryLabel("AT", countries)).toBe("AT");
  });

  it("returns null when the group has no holiday country", () => {
    expect(holidayCountryLabel(null, countries)).toBeNull();
  });
});
