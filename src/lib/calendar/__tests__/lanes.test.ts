import {
  bankHolidaysToRanges,
  groupConsecutiveByRunKey,
  placeWeek,
  type CalendarRange,
} from "../lanes";
import { monthWeeks } from "../month-grid";

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
    pending: false,
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
      from: "2026-06-08",
      to: "2026-06-10",
      vacationIds: ["v-u1-2026-06-08", "v-u1-2026-06-09", "v-u1-2026-06-10"],
    });
  });

  it("returns two ranges when a day is missing between them", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-10" }),
    ]);

    expect(ranges.map((r) => [r.from, r.to])).toEqual([
      ["2026-06-08", "2026-06-08"],
      ["2026-06-10", "2026-06-10"],
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
      ["2026-06-08", "approved", false],
      ["2026-06-09", "pending", false],
      ["2026-06-10", "pending", true],
    ]);
  });

  it("returns a range as pending while a change or a Provisional row holds any of its days", () => {
    const [held, free] = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-09", pending: true }),
      row({ requestedDay: "2026-06-08", userId: "u2" }),
    ]);

    expect([held.userId, held.pending]).toEqual(["u1", true]);
    expect([free.userId, free.pending]).toEqual(["u2", false]);
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

  it("returns distinct ids for a create in flight over a day already booked", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-08", status: "pending" }),
      row({
        id: "pending-1:2026-06-08",
        requestedDay: "2026-06-08",
        status: "pending",
        pending: true,
      }),
    ]);

    expect(ranges).toHaveLength(2);
    expect(new Set(ranges.map((r) => r.id)).size).toBe(2);
  });

  it("sorts unsorted input before grouping", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-06-10" }),
      row({ requestedDay: "2026-06-08" }),
      row({ requestedDay: "2026-06-09" }),
    ]);

    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({ from: "2026-06-08", to: "2026-06-10" });
  });

  it("returns one range for a run that crosses into the next month", () => {
    const ranges = groupConsecutiveByRunKey([
      row({ requestedDay: "2026-09-30" }),
      row({ requestedDay: "2026-10-01" }),
    ]);

    expect(ranges.map((r) => [r.from, r.to])).toEqual([["2026-09-30", "2026-10-01"]]);
  });
});

describe("bankHolidaysToRanges", () => {
  it("returns one range per run of consecutive holidays, carrying every name", () => {
    const ranges = bankHolidaysToRanges([
      { date: "2026-12-24", name: "Christmas Eve" },
      { date: "2026-12-26", name: "St Stephen's Day" },
      { date: "2026-12-25", name: "Christmas Day" },
    ]);

    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({
      userId: null,
      type: "BANK_HOLIDAY",
      from: "2026-12-24",
      to: "2026-12-26",
      names: ["Christmas Eve", "Christmas Day", "St Stephen's Day"],
    });
  });

  it("returns one range for the same date in two countries, each name once", () => {
    const ranges = bankHolidaysToRanges([
      { date: "2026-10-28", name: "Independence Day" },
      { date: "2026-10-28", name: "Independence Day" },
      { date: "2026-10-28", name: "Ochi Day" },
    ]);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].names).toEqual(["Independence Day", "Ochi Day"]);
  });

  it("returns separate ranges across a gap, each placed by its date", () => {
    const ranges = bankHolidaysToRanges([
      { date: "2026-09-28", name: "Statehood Day" },
      { date: "2026-10-01", name: "First" },
      { date: "2026-10-28", name: "Independence Day" },
    ]);

    expect(ranges.map((r) => [r.from, r.to])).toEqual([
      ["2026-09-28", "2026-09-28"],
      ["2026-10-01", "2026-10-01"],
      ["2026-10-28", "2026-10-28"],
    ]);
  });

  it("returns one range for consecutive holidays across a month boundary", () => {
    const ranges = bankHolidaysToRanges([
      { date: "2026-12-31", name: "New Year's Eve" },
      { date: "2027-01-01", name: "New Year's Day" },
    ]);

    expect(ranges.map((r) => [r.from, r.to])).toEqual([["2026-12-31", "2027-01-01"]]);
  });
});

describe("placeWeek", () => {
  const [SEPT_28_TO_OCT_4, , OCT_12_TO_18, , OCT_26_TO_NOV_1] = monthWeeks({
    year: 2026,
    month: 10,
  });
  const WEEK = OCT_12_TO_18;
  const VIEWER = "me";

  function bar(id: string, from: string, to: string, userId = id): CalendarRange {
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
      pending: false,
    };
  }

  function holiday(date: string): CalendarRange {
    return { ...bar(`bank-${date}`, date, date, ""), userId: null, type: "BANK_HOLIDAY" };
  }

  const place = (ranges: CalendarRange[], week = WEEK) =>
    placeWeek(week, ranges, { maxLanes: 2, viewerId: VIEWER });

  it("returns a bar's columns, flagging the edges it runs past", () => {
    const { shown } = place([
      bar("a", "2026-10-09", "2026-10-14"),
      bar("b", "2026-10-16", "2026-10-23"),
    ]);

    expect(
      shown.map((b) => [b.range.id, b.startColumn, b.endColumn, b.continuesLeft, b.continuesRight])
    ).toEqual([
      ["a", 0, 3, true, false],
      ["b", 4, 7, false, true],
    ]);
  });

  it("returns bars that do not overlap in one lane", () => {
    const { shown } = place([
      bar("a", "2026-10-12", "2026-10-13"),
      bar("b", "2026-10-14", "2026-10-16"),
    ]);

    expect(shown.map((b) => b.lane)).toEqual([0, 0]);
  });

  it("returns the bars past two lanes as hidden, per day they cover", () => {
    const { shown, hidden } = place([
      bar("a", "2026-10-12", "2026-10-16"),
      bar("b", "2026-10-13", "2026-10-14"),
      bar("c", "2026-10-14", "2026-10-15"),
    ]);

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
      holiday("2026-10-12"),
      holiday("2026-10-15"),
      bar("a", "2026-10-12", "2026-10-13"),
      bar("b", "2026-10-12", "2026-10-12"),
    ]);

    expect(bankRows).toBe(1);
    expect(bank.map((b) => b.startColumn)).toEqual([0, 3]);
    expect(shown.map((b) => b.range.id)).toEqual(["a"]);
    expect(hidden.get(0)?.map((r) => r.id)).toEqual(["b"]);
  });

  it("returns the viewer's own bars first, so they never hide behind +N", () => {
    const { shown, hidden } = place([
      bar("a", "2026-10-12", "2026-10-16"),
      bar("b", "2026-10-12", "2026-10-16"),
      bar("mine", "2026-10-14", "2026-10-14", VIEWER),
    ]);

    expect(shown.map((b) => [b.range.id, b.lane])).toEqual([
      ["mine", 0],
      ["a", 1],
    ]);
    expect(hidden.get(2)?.map((r) => r.id)).toEqual(["b"]);
  });

  it("returns the viewer's bar on the lane a bank holiday leaves", () => {
    const { shown } = place([
      holiday("2026-10-12"),
      bar("a", "2026-10-12", "2026-10-16"),
      bar("mine", "2026-10-15", "2026-10-16", VIEWER),
    ]);

    expect(shown.map((b) => b.range.id)).toEqual(["mine"]);
  });

  it("returns nothing for ranges outside the week", () => {
    const { shown, bank } = place([
      bar("a", "2026-10-05", "2026-10-11"),
      bar("b", "2026-10-19", "2026-10-20"),
      holiday("2026-10-11"),
    ]);

    expect(shown).toEqual([]);
    expect(bank).toEqual([]);
  });

  it("returns a bar and a holiday on the padding days of a short week by their dates", () => {
    const { shown, bank } = place(
      [bar("a", "2026-09-25", "2026-10-01"), holiday("2026-09-28")],
      SEPT_28_TO_OCT_4
    );

    expect(
      shown.map((b) => [b.range.id, b.startColumn, b.endColumn, b.continuesLeft, b.continuesRight])
    ).toEqual([["a", 0, 4, true, false]]);
    expect(bank.map((b) => [b.startColumn, b.endColumn])).toEqual([[0, 1]]);
  });

  it("returns a bar that runs into the next month's padding days as one bar", () => {
    const { shown } = place([bar("a", "2026-10-30", "2026-11-03")], OCT_26_TO_NOV_1);

    expect(
      shown.map((b) => [b.startColumn, b.endColumn, b.continuesLeft, b.continuesRight])
    ).toEqual([[4, 7, false, true]]);
  });
});
