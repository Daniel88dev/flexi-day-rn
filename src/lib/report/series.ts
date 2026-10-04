import type { CalendarRecordType } from "@/lib/local-store";

import { round } from "./round";
import type { DatedUsage, MonthSlot } from "./window";

export type TeamMonthRow = MonthSlot & { values: Record<string, number> };

const slotKey = (year: number, month: number) => `${year}-${month}`;

/**
 * One row per slot with every member present, zero-filled. A value is used plus pending days, so
 * a column reads as the days committed that month.
 */
export function buildTeamMonthlySeries(
  usage: DatedUsage[],
  memberIds: string[],
  type: CalendarRecordType,
  slots: MonthSlot[]
): TeamMonthRow[] {
  const ids = new Set(memberIds);
  const byKey = new Map<string, TeamMonthRow>();
  for (const slot of slots) {
    const values: Record<string, number> = {};
    for (const id of memberIds) values[id] = 0;
    byKey.set(slotKey(slot.year, slot.month), { ...slot, values });
  }
  for (const entry of usage) {
    if (entry.vacationType !== type || !ids.has(entry.userId)) continue;
    const row = byKey.get(slotKey(entry.year, entry.month));
    if (!row) continue;
    row.values[entry.userId] = round(row.values[entry.userId] + entry.used + entry.pending);
  }
  return Array.from(byKey.values());
}

export function seriesTotal(series: TeamMonthRow[]): number {
  return round(
    series.reduce(
      (total, row) => total + Object.values(row.values).reduce((sum, value) => sum + value, 0),
      0
    )
  );
}
