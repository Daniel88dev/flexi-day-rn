/**
 * The mark a day cell carries for its birthdays and group events: one cake however many
 * birthdays, at most one dot however many events, and the event count beside the dot only when
 * the cell has room for it. Lanes draw it in a row right of the day number; stripes stack it in the
 * cell's top-right corner, cake over dot.
 */
export type DayMarkSize = "lane" | "stripe";

export type DayMarkParts = {
  cake: boolean;
  dot: boolean;
  /** The event count beside the dot, null when there is one event or no room. */
  count: number | null;
  /** How wide the mark draws, in points. */
  width: number;
};

export const DAY_MARK_METRICS = {
  lane: { cake: 11, dot: 6, digit: 5.5, gap: 2, countGap: 1 },
  stripe: { cake: 10, dot: 4.5, digit: 5, gap: 2, countGap: 1 },
} as const;

/** Lanes: the cell's `px-1` padding, the 22 pt day pill and the 3 pt gap beside it. */
export function laneMarkRoom(cellWidth: number): number {
  return cellWidth - 8 - 22 - 3;
}

const STRIPE_DAY_CIRCLE = 28;
const STRIPE_MARK_INSET = 3;
/** The day circle is round, so a mark at its top-right reaches a little past its bounding box. */
const STRIPE_CORNER_CLEARANCE = 4;

/** Stripes: the corner right of the 28 pt day circle, past the mark's inset. */
export function stripeMarkRoom(cellWidth: number): number {
  return (cellWidth - STRIPE_DAY_CIRCLE) / 2 + STRIPE_CORNER_CLEARANCE - STRIPE_MARK_INSET;
}

export function dayMark({
  birthdays,
  events,
  room,
  size,
}: {
  birthdays: number;
  events: number;
  room: number;
  size: DayMarkSize;
}): DayMarkParts | null {
  const cake = birthdays > 0;
  const dot = events > 0;
  if (!cake && !dot) return null;

  const metrics = DAY_MARK_METRICS[size];
  const widthWith = (count: number | null) => {
    const dotRow = dot
      ? metrics.dot + (count === null ? 0 : metrics.countGap + String(count).length * metrics.digit)
      : 0;
    const cakeWidth = cake ? metrics.cake : 0;
    if (size === "stripe") return Math.max(cakeWidth, dotRow);
    return cakeWidth + (cake && dot ? metrics.gap : 0) + dotRow;
  };

  const counted = events > 1 && widthWith(events) <= room ? events : null;
  return { cake, dot, count: counted, width: widthWith(counted) };
}

/** What a day carries into its mark. Group events (T-361) add their count to `events`. */
export type DayMarkCounts = { birthdays: number; events: number };

export type DayMarks = ReadonlyMap<string, DayMarkCounts>;

export function dayMarkCounts({
  birthdays,
}: {
  birthdays: readonly { date: string }[];
}): Map<string, DayMarkCounts> {
  const marks = new Map<string, DayMarkCounts>();
  for (const { date } of birthdays) {
    const mark = marks.get(date) ?? { birthdays: 0, events: 0 };
    marks.set(date, { ...mark, birthdays: mark.birthdays + 1 });
  }
  return marks;
}
