import { placeWeek, type CalendarRange, type PlacedBar, type Week } from "@/lib/calendar/lanes";

const MAX_STRIPES = 3;

/** A stripe is too thin for the lanes' dashed outline, so a pending one is faded instead. */
export type PlacedStripe = PlacedBar & { faded: boolean };

export type PlacedStripeWeek = {
  stripes: PlacedStripe[];
  /** Per column, how many ranges found no stripe. */
  more: Map<number, number>;
  /** The columns a bank holiday tints. */
  holidays: Set<number>;
};

/**
 * The lanes' packing at three per week, the viewer's own first. A bank holiday tints its days
 * instead of taking a stripe.
 */
export function placeStripeWeek(
  week: Week,
  ranges: readonly CalendarRange[],
  { viewerId }: { viewerId: string | null }
): PlacedStripeWeek {
  const holidays = new Set<number>();
  for (const range of ranges) {
    if (range.type !== "BANK_HOLIDAY") continue;
    week.forEach((day, column) => {
      if (day !== null && day >= range.from && day <= range.to) holidays.add(column);
    });
  }

  const people = ranges.filter((range) => range.type !== "BANK_HOLIDAY");
  const { shown, hidden } = placeWeek(week, people, { maxLanes: MAX_STRIPES, viewerId });
  return {
    stripes: shown.map((bar) => ({
      ...bar,
      faded: bar.range.status === "pending" || bar.range.pending,
    })),
    more: new Map([...hidden].map(([column, list]) => [column, list.length])),
    holidays,
  };
}
