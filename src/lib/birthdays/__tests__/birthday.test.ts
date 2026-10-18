import {
  ageAtNextBirthday,
  audience,
  birthdayOccurrences,
  draftOf,
  savedBirthday,
  shareSwitchState,
} from "../birthday";

describe("birthdayOccurrences", () => {
  it("returns 28 February 2027 at age 37 for a birthday on 29 February 1990", () => {
    expect(
      birthdayOccurrences(
        { month: 2, day: 29, year: 1990 },
        { from: "2027-01-01", until: "2028-01-01" }
      )
    ).toEqual([{ date: "2027-02-28", age: 37 }]);
  });

  it("returns 29 February in a leap year", () => {
    expect(
      birthdayOccurrences(
        { month: 2, day: 29, year: 1992 },
        { from: "2028-02-01", until: "2028-03-01" }
      )
    ).toEqual([{ date: "2028-02-29", age: 36 }]);
  });

  it("returns one date per year a window spans, with no age without a year", () => {
    expect(
      birthdayOccurrences(
        { month: 1, day: 2, year: null },
        { from: "2026-12-26", until: "2027-01-07" }
      )
    ).toEqual([{ date: "2027-01-02", age: null }]);
    expect(
      birthdayOccurrences(
        { month: 12, day: 30, year: 2000 },
        { from: "2026-12-26", until: "2028-01-07" }
      )
    ).toEqual([
      { date: "2026-12-30", age: 26 },
      { date: "2027-12-30", age: 27 },
    ]);
  });

  it("leaves out the until day, which the range excludes", () => {
    expect(
      birthdayOccurrences(
        { month: 3, day: 1, year: null },
        { from: "2027-02-01", until: "2027-03-01" }
      )
    ).toEqual([]);
  });

  it("shows nothing before the birth year and age 0 on the day itself", () => {
    expect(
      birthdayOccurrences(
        { month: 6, day: 5, year: 2026 },
        { from: "2025-01-01", until: "2027-01-01" }
      )
    ).toEqual([{ date: "2026-06-05", age: 0 }]);
  });
});

describe("ageAtNextBirthday", () => {
  it("returns the age turned on the coming birthday, today included", () => {
    expect(ageAtNextBirthday({ month: 3, day: 14, year: 1988 }, "2026-03-13")).toBe(38);
    expect(ageAtNextBirthday({ month: 3, day: 14, year: 1988 }, "2026-03-14")).toBe(38);
    expect(ageAtNextBirthday({ month: 3, day: 14, year: 1988 }, "2026-03-15")).toBe(39);
    expect(ageAtNextBirthday({ month: 3, day: 14, year: 1988 }, "2026-10-18")).toBe(39);
  });

  it("returns the age on 28 February for a 29 February birthday in a non-leap year", () => {
    expect(ageAtNextBirthday({ month: 2, day: 29, year: 1992 }, "2027-02-28")).toBe(35);
    expect(ageAtNextBirthday({ month: 2, day: 29, year: 1992 }, "2027-03-01")).toBe(36);
    expect(ageAtNextBirthday({ month: 2, day: 29, year: 1992 }, "2028-02-29")).toBe(36);
  });

  it("returns null without a year", () => {
    expect(ageAtNextBirthday({ month: 3, day: 14, year: null }, "2026-10-18")).toBeNull();
  });
});

describe("shareSwitchState", () => {
  it("returns open while a group is on a paid plan", () => {
    expect(shareSwitchState({ canShare: true, storedShared: false, shareGroups: [] })).toBe("open");
  });

  it("returns lapsed when sharing stays on, or lapsed groups still show it", () => {
    expect(shareSwitchState({ canShare: false, storedShared: true, shareGroups: [] })).toBe(
      "lapsed"
    );
    expect(
      shareSwitchState({
        canShare: false,
        storedShared: false,
        shareGroups: [{ groupId: "g", groupName: "Design" }],
      })
    ).toBe("lapsed");
  });

  it("returns notice with no paid or lapsed group", () => {
    expect(shareSwitchState({ canShare: false, storedShared: false, shareGroups: [] })).toBe(
      "notice"
    );
  });
});

describe("audience", () => {
  const groups = [
    { groupId: "g-1", groupName: "Design" },
    { groupId: "g-2", groupName: "Platform" },
  ];

  it("returns the date and age for everyone a shared birthday with a year reaches", () => {
    expect(
      audience({ birthday: { month: 3, day: 14, year: 1988, shared: true }, shareGroups: groups })
    ).toEqual([
      { who: "you", date: true, age: true },
      { who: "groups", names: ["Design", "Platform"], date: true, age: true },
      { who: "teamFeeds", date: true, age: false },
      { who: "providers", date: false, age: false },
    ]);
  });

  it("returns only the viewer while the birthday is not shared", () => {
    expect(
      audience({ birthday: { month: 3, day: 14, year: null, shared: false }, shareGroups: groups })
    ).toEqual([
      { who: "you", date: true, age: false },
      { who: "groups", names: ["Design", "Platform"], date: false, age: false },
      { who: "teamFeeds", date: false, age: false },
      { who: "providers", date: false, age: false },
    ]);
  });

  it("returns nothing for anyone without a birthday", () => {
    expect(audience({ birthday: null, shareGroups: [] })[0]).toEqual({
      who: "you",
      date: false,
      age: false,
    });
  });
});

describe("draftOf", () => {
  it("returns the stored date with its year, or a leap-year stand-in for the wheel", () => {
    expect(draftOf({ month: 3, day: 14, year: 1988, shared: false })).toEqual({
      date: { month: 3, day: 14, year: 1988 },
      withYear: true,
    });
    expect(draftOf({ month: 2, day: 29, year: null, shared: true })).toEqual({
      date: { month: 2, day: 29, year: 2000 },
      withYear: false,
    });
    expect(draftOf(null)).toEqual({ date: { month: 1, day: 1, year: 2000 }, withYear: false });
  });
});

describe("savedBirthday", () => {
  it("drops the wheel's year when the year is off and keeps sharing as stored", () => {
    expect(
      savedBirthday({ date: { month: 2, day: 29, year: 1992 }, withYear: false }, true)
    ).toEqual({ month: 2, day: 29, year: null, shared: true });
    expect(
      savedBirthday({ date: { month: 2, day: 29, year: 1992 }, withYear: true }, false)
    ).toEqual({ month: 2, day: 29, year: 1992, shared: false });
  });
});
