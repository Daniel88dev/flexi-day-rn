import {
  bankHolidaysToRanges,
  buildWeeks,
  groupConsecutiveByRunKey,
  placeWeek,
  type CalendarRange,
  type Week,
} from "../lanes";

describe("buildWeeks", () => {
  it("returns Monday-first weeks padded with nulls on both ends", () => {
    expect(buildWeeks({ year: 2026, month: 10 })).toEqual([
      [null, null, null, 1, 2, 3, 4],
      [5, 6, 7, 8, 9, 10, 11],
      [12, 13, 14, 15, 16, 17, 18],
      [19, 20, 21, 22, 23, 24, 25],
      [26, 27, 28, 29, 30, 31, null],
    ]);
  });

  it("returns six weeks for a month that starts on a Saturday", () => {
    const weeks = buildWeeks({ year: 2026, month: 8 });

    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, 1, 2]);
    expect(weeks[5]).toEqual([31, null, null, null, null, null, null]);
  });

  it("returns four full weeks for a February that starts on a Monday", () => {
    const weeks = buildWeeks({ year: 2027, month: 2 });

    expect(weeks).toHaveLength(4);
    expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weeks[3]).toEqual([22, 23, 24, 25, 26, 27, 28]);
  });
});

type Row = Parameters<typeof groupConsecutiveByRunKey>[0][number];

function row(patch: Partial<Row> & Pick<Row, "requestedDay">): Row {
  return {
    id: `v-${patch.userId ?? "u1"}-${patch.requestedDay}`,
    userId: "u1",
    userName: "Dana Holt",
    groupId: "g1",
    vacationType: "VACATION",
    status: "approved",
    halfDay: false,
    startTime: null,
    endTime: null,
    ...patch,
  };
}

describe("groupConsecutiveByRunKey", () => {
  it("returns an empty list when given no rows", () => {
    expect(groupConsecutiveByRunKey([])).toEqual([]);
  });

  it("collapses three consecutive days of one person and type into one range", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-09" }),
      row({ requestedDay: "2026-06-10" }),
    ]);

    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({
      userId: "u1",
      userName: "Dana Holt",
      type: "VACATION",
      from: 8,
      to: 10,
      vacationIds: ["v-u1-2026-06-08", "v-u1-2026-06-09", "v-u1-2026-06-10"],
    });
  });

  it("returns two ranges when a day is missing between them", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-10" }),
    ]);

    expect(ranges.map((r) => [r.from, r.to])).toEqual([
      [8, 8],
      [10, 10],
    ]);
  });

  it("returns separate ranges for different types or different people", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-09", vacationType: "HOME_OFFICE" }),
      row({ requestedDay: "2026-06-10", userId: "u2" }),
    ]);

    expect(ranges).toHaveLength(3);
  });

  it("returns separate ranges where the status or the half day changes", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-09", status: "pending" }),
      row({ requestedDay: "2026-06-10", status: "pending", halfDay: true }),
    ]);

    expect(ranges.map((r) => [r.from, r.status, r.halfDay])).toEqual([
      [8, "approved", false],
      [9, "pending", false],
      [10, "pending", true],
    ]);
  });

  it("returns separate ranges for rows of the same person in different groups", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-09", groupId: "g2" }),
    ]);

    expect(ranges).toHaveLength(2);
  });

  it("returns ranges with ids that stay put when another range drops out", () => {
    const rows = [
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-09", userId: "u2" }),
      row({ requestedDay: "2026-06-10", userId: "u3" }),
    ];

    const before = groupConsecutiveByRunKey(rows);
    const after = groupConsecutiveByRunKey(rows.filter((r) => r.userId !== "u1"));

    expect(new Set(before.map((r) => r.id)).size).toBe(3);
    expect(after.map((r) => r.id)).toEqual(before.slice(1).map((r) => r.id));
  });

  it("sorts unsorted input before grouping", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-10" }),
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-09" }),
    ]);

    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({ from: 8, to: 10 });
  });
});

describe("bankHolidaysToRanges", () => {
  const OCTOBER = { year: 2026, month: 10 };

  it("returns one range per run of consecutive holidays, carrying every name", () => {
    const ranges = bankHolidaysToRanges(
      [
        { date: "2026-12-24", name: "Christmas Eve" },
        { date: "2026-12-26", name: "St Stephen's Day" },
        { date: "2026-12-25", name: "Christmas Day" },
      ],
      { year: 2026, month: 12 }
    );

    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({
      userId: null,
      type: "BANK_HOLIDAY",
      from: 24,
      to: 26,
      names: ["Christmas Eve", "Christmas Day", "St Stephen's Day"],
    });
  });

  it("returns one range for the same date in two countries, each name once", () => {
    const ranges = bankHolidaysToRanges(
      [
        { date: "2026-10-28", name: "Independence Day" },
        { date: "2026-10-28", name: "Independence Day" },
        { date: "2026-10-28", name: "Ochi Day" },
      ],
      OCTOBER
    );

    expect(ranges).toHaveLength(1);
    expect(ranges[0].names).toEqual(["Independence Day", "Ochi Day"]);
  });

  it("returns separate ranges across a gap and leaves out other months", () => {
    const ranges = bankHolidaysToRanges(
      [
        { date: "2026-09-28", name: "Statehood Day" },
        { date: "2026-10-01", name: "First" },
        { date: "2026-10-28", name: "Independence Day" },
      ],
      OCTOBER
    );

    expect(ranges.map((r) => [r.from, r.to])).toEqual([
      [1, 1],
      [28, 28],
    ]);
  });
});

describe("placeWeek", () => {
  // 12-18 October 2026, Monday to Sunday.
  const WEEK: Week = [12, 13, 14, 15, 16, 17, 18];
  const VIEWER = "me";

  function bar(id: string, from: number, to: number, userId = id): CalendarRange {
    return {
      id,
      userId,
      userName: null,
      type: "VACATION",
      status: "approved",
      halfDay: false,
      from,
      to,
      vacationIds: [`${id}-v`],
      names: [],
    };
  }

  function holiday(day: number): CalendarRange {
    return { ...bar(`bank-${day}`, day, day, ""), userId: null, type: "BANK_HOLIDAY" };
  }

  const place = (ranges: CalendarRange[], week = WEEK) =>
    placeWeek(week, ranges, { maxLanes: 2, viewerId: VIEWER });

  it("returns a bar's columns, flagging the edges it runs past", () => {
    const { shown } = place([bar("a", 9, 14), bar("b", 16, 23)]);

    expect(
      shown.map((b) => [b.range.id, b.startColumn, b.endColumn, b.continuesLeft, b.continuesRight])
    ).toEqual([
      ["a", 0, 3, true, false],
      ["b", 4, 7, false, true],
    ]);
  });

  it("returns bars that do not overlap in one lane", () => {
    const { shown } = place([bar("a", 12, 13), bar("b", 14, 16)]);

    expect(shown.map((b) => b.lane)).toEqual([0, 0]);
  });

  it("returns the bars past two lanes as hidden, per day they cover", () => {
    const { shown, hidden } = place([bar("a", 12, 16), bar("b", 13, 14), bar("c", 14, 15)]);

    expect(shown.map((b) => [b.range.id, b.lane])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    expect([...hidden.entries()].map(([column, list]) => [column, list.map((r) => r.id)])).toEqual([
      [2, ["c"]],
      [3, ["c"]],
    ]);
  });

  it("returns the bank holidays on one lane of the budget, however many there are", () => {
    const { bank, shown, hidden, bankRows } = place([
      holiday(12),
      holiday(15),
      bar("a", 12, 13),
      bar("b", 12, 12),
    ]);

    expect(bankRows).toBe(1);
    expect(bank.map((b) => b.startColumn)).toEqual([0, 3]);
    expect(shown.map((b) => b.range.id)).toEqual(["a"]);
    expect(hidden.get(0)?.map((r) => r.id)).toEqual(["b"]);
  });

  it("returns the viewer's own bars first, so they never hide behind +N", () => {
    const { shown, hidden } = place([
      bar("a", 12, 16),
      bar("b", 12, 16),
      bar("mine", 14, 14, VIEWER),
    ]);

    expect(shown.map((b) => [b.range.id, b.lane])).toEqual([
      ["mine", 0],
      ["a", 1],
    ]);
    expect(hidden.get(2)?.map((r) => r.id)).toEqual(["b"]);
  });

  it("returns the viewer's bar on the lane a bank holiday leaves", () => {
    const { shown } = place([holiday(12), bar("a", 12, 16), bar("mine", 15, 16, VIEWER)]);

    expect(shown.map((b) => b.range.id)).toEqual(["mine"]);
  });

  it("returns nothing for ranges outside the week and for the padding of a short week", () => {
    const firstWeek: Week = [null, null, null, 1, 2, 3, 4];
    const { shown } = place([bar("a", 1, 2), bar("b", 5, 9)], firstWeek);

    expect(shown.map((b) => [b.range.id, b.startColumn, b.endColumn])).toEqual([["a", 3, 5]]);
  });
});
