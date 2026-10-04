import type { ReportBooking } from "./types";

/** The server orders bookings by group and type; a person reads them latest first. */
export function bookingsNewestFirst(bookings: ReportBooking[]): ReportBooking[] {
  return [...bookings].sort((a, b) => b.from.localeCompare(a.from) || b.to.localeCompare(a.to));
}

export type KeyedBooking = { key: string; booking: ReportBooking };

/** Bookings carry no id, and a day can be rejected more than once, so a repeat gets a suffix. */
export function keyedBookings(bookings: ReportBooking[]): KeyedBooking[] {
  const seen = new Map<string, number>();
  return bookings.map((booking) => {
    const base = [
      booking.groupId,
      booking.vacationType,
      booking.from,
      booking.to,
      booking.status,
    ].join("-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { key: count === 0 ? base : `${base}-${count}`, booking };
  });
}
