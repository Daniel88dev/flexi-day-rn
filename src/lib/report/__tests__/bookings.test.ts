import { crossMember2026 } from "@/test-support/report";

import { bookingsNewestFirst, keyedBookings } from "../bookings";

describe("bookingsNewestFirst", () => {
  it("returns the bookings latest first without touching the server's list", () => {
    const before = crossMember2026.bookings.map((entry) => entry.from);

    const sorted = bookingsNewestFirst(crossMember2026.bookings).map((entry) => entry.from);

    expect(sorted).toEqual(["2026-07-01", "2026-02-20", "2026-02-10", "2026-02-02", "2026-01-19"]);
    expect(crossMember2026.bookings.map((entry) => entry.from)).toEqual(before);
  });

  it("returns the longer of two bookings that start the same day first", () => {
    const [base] = crossMember2026.bookings;
    const short = { ...base, from: "2026-03-02", to: "2026-03-02" };
    const long = { ...base, from: "2026-03-02", to: "2026-03-04" };

    expect(bookingsNewestFirst([short, long])).toEqual([long, short]);
  });
});

describe("keyedBookings", () => {
  it("returns a key per booking and a suffix for a day rejected twice", () => {
    const [base] = crossMember2026.bookings;
    const rejected = { ...base, status: "rejected" as const };

    const keys = keyedBookings([base, rejected, rejected]).map((entry) => entry.key);

    expect(keys).toEqual([
      "g-team-VACATION-2026-02-02-2026-02-03-approved",
      "g-team-VACATION-2026-02-02-2026-02-03-rejected",
      "g-team-VACATION-2026-02-02-2026-02-03-rejected-1",
    ]);
  });
});
