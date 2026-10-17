import { dayMark, dayMarkCounts, laneMarkRoom, stripeMarkRoom } from "../day-mark";

// The iPhone 17 Pro is 402 pt wide: lane cells (402 - 34) / 7, stripe cells (402 - 32) / 7.
const LANE_CELL = (402 - 34) / 7;
const STRIPE_CELL = (402 - 32) / 7;

describe("laneMarkRoom", () => {
  it("returns what a 52 pt lane cell leaves right of the day number", () => {
    expect(laneMarkRoom(LANE_CELL)).toBeCloseTo(19.57, 1);
  });
});

describe("dayMark", () => {
  it("returns nothing for a day without birthdays or events", () => {
    expect(dayMark({ birthdays: 0, events: 0, room: 40, size: "lane" })).toBeNull();
  });

  it("returns one cake however many birthdays fall on the day", () => {
    expect(
      dayMark({ birthdays: 3, events: 0, room: laneMarkRoom(LANE_CELL), size: "lane" })
    ).toEqual({ cake: true, dot: false, count: null, width: 11 });
  });

  it("caps a busy lane day at the cake and one dot, without the count it has no room for", () => {
    const mark = dayMark({ birthdays: 1, events: 2, room: laneMarkRoom(LANE_CELL), size: "lane" });
    expect(mark).toEqual({ cake: true, dot: true, count: null, width: 19 });
    expect(mark!.width).toBeLessThanOrEqual(laneMarkRoom(LANE_CELL));
  });

  it("adds the count beside the dot when the cell has room", () => {
    expect(
      dayMark({ birthdays: 0, events: 3, room: laneMarkRoom(LANE_CELL), size: "lane" })
    ).toEqual({ cake: false, dot: true, count: 3, width: 12.5 });
    expect(dayMark({ birthdays: 1, events: 3, room: 40, size: "lane" })).toEqual({
      cake: true,
      dot: true,
      count: 3,
      width: 25.5,
    });
  });

  it("drops a count whose digits do not fit", () => {
    expect(dayMark({ birthdays: 0, events: 12, room: 15, size: "lane" })).toEqual({
      cake: false,
      dot: true,
      count: null,
      width: 6,
    });
  });

  it("stacks the stripes mark in the corner, inside the room a 52 pt cell leaves", () => {
    const room = stripeMarkRoom(STRIPE_CELL);
    const mark = dayMark({ birthdays: 1, events: 2, room, size: "stripe" });
    expect(mark).toEqual({ cake: true, dot: true, count: 2, width: 10.5 });
    expect(mark!.width).toBeLessThanOrEqual(room);
    expect(dayMark({ birthdays: 1, events: 0, room, size: "stripe" })).toEqual({
      cake: true,
      dot: false,
      count: null,
      width: 10,
    });
  });
});

describe("dayMarkCounts", () => {
  it("returns how many birthdays fall on each day", () => {
    expect(
      dayMarkCounts({
        birthdays: [{ date: "2026-10-14" }, { date: "2026-10-14" }, { date: "2026-10-20" }],
      })
    ).toEqual(
      new Map([
        ["2026-10-14", { birthdays: 2, events: 0 }],
        ["2026-10-20", { birthdays: 1, events: 0 }],
      ])
    );
  });
});
