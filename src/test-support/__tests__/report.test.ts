import { periodSlots, remainingFor, yearsInWindow } from "@/lib/report";

import {
  CROSS_YEAR_TODAY,
  crossMember2025,
  crossMember2026,
  crossOverview2025,
  crossOverview2026,
  crossScope,
} from "../report";

describe("cross-year report fixtures", () => {
  it("returns a rolling window across 2025 and 2026 that the scope lists both years of", () => {
    const years = yearsInWindow(periodSlots("rolling", CROSS_YEAR_TODAY));
    expect(years).toEqual([2025, 2026]);
    expect(crossScope.years).toEqual(years);
    expect([crossOverview2025.year, crossOverview2026.year]).toEqual(years);
    expect([crossMember2025.year, crossMember2026.year]).toEqual(years);
  });

  it("returns an administered group with canEditQuotas and a self group", () => {
    expect(crossScope.groups).toContainEqual(
      expect.objectContaining({ groupId: "g-support", access: "all", canEditQuotas: true })
    );
    expect(crossScope.groups).toContainEqual(
      expect.objectContaining({ groupId: "g-design", access: "self" })
    );
  });

  it("returns carry-over, an overdraft and a Sick day allowance", () => {
    const member = (id: string) => crossScope.members.find((entry) => entry.id === id)!;
    const summary = crossOverview2026.summary;
    expect(remainingFor(member("u-frank"), summary, "VACATION").carriedOver).toBe(3);
    expect(remainingFor(member("u-bob"), summary, "VACATION").overdraft).toBe(-1.5);
    expect(summary.some((row) => row.vacationType === "SICK_DAY")).toBe(true);
  });

  it("returns bookings in every status and changes by a person, a deleted account and the rollover", () => {
    const statuses = new Set(crossMember2026.bookings.map((entry) => entry.status));
    expect([...statuses].sort()).toEqual(["approved", "pending", "rejected"]);

    const [byPerson, byDeleted, rollover] = crossMember2026.changes;
    expect(byPerson.actor?.name).toBe("Olivia Owner");
    expect(byDeleted).toMatchObject({ actor: null, actorDeleted: true });
    expect(rollover).toMatchObject({ actor: null, actorDeleted: false });
  });
});
