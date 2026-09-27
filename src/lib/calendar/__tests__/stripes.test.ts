import type { CalendarRange, Week } from "../lanes";
import { placeStripeWeek } from "../stripes";

const WEEK: Week = [12, 13, 14, 15, 16, 17, 18];

function range(patch: Partial<CalendarRange> & Pick<CalendarRange, "id">): CalendarRange {
  return {
    userId: patch.id,
    userName: null,
    type: "VACATION",
    status: "approved",
    halfDay: false,
    from: 12,
    to: 16,
    vacationIds: [patch.id],
    names: [],
    pending: false,
    ...patch,
  };
}

const stripeIds = (placed: ReturnType<typeof placeStripeWeek>) =>
  placed.stripes.map((stripe) => stripe.range.id);

describe("placeStripeWeek", () => {
  it("returns the viewer's stripe first and at most three, with the rest counted per day", () => {
    const placed = placeStripeWeek(
      WEEK,
      [
        range({ id: "ada" }),
        range({ id: "ben" }),
        range({ id: "cyd", from: 13, to: 14 }),
        range({ id: "me", from: 14, to: 15 }),
      ],
      { viewerId: "me" }
    );

    expect(stripeIds(placed)).toEqual(["me", "ada", "ben"]);
    expect(placed.stripes.find((stripe) => stripe.range.id === "me")?.lane).toBe(0);
    expect(placed.more).toEqual(
      new Map([
        [1, 1],
        [2, 1],
      ])
    );
  });

  it("returns a bank holiday as tinted days that leave all three stripes to people", () => {
    const placed = placeStripeWeek(
      WEEK,
      [
        range({ id: "bank|2026-10-15", userId: null, type: "BANK_HOLIDAY", from: 15, to: 16 }),
        range({ id: "ada" }),
        range({ id: "ben" }),
        range({ id: "cyd" }),
      ],
      { viewerId: "me" }
    );

    expect(placed.holidays).toEqual(new Set([3, 4]));
    expect(stripeIds(placed)).toEqual(["ada", "ben", "cyd"]);
    expect(placed.more.size).toBe(0);
  });

  it("returns a pending request, and one a pending change holds, as faded stripes", () => {
    const placed = placeStripeWeek(
      WEEK,
      [
        range({ id: "asked", status: "pending" }),
        range({ id: "sending", pending: true }),
        range({ id: "approved" }),
      ],
      { viewerId: null }
    );

    const faded = Object.fromEntries(
      placed.stripes.map((stripe) => [stripe.range.id, stripe.faded])
    );
    expect(faded).toEqual({ asked: true, sending: true, approved: false });
  });
});
