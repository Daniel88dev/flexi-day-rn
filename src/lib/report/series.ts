import type { CalendarRecordType } from "@/lib/local-store";

import { round } from "./round";
import type { ReportSummaryRow } from "./types";
import { yearsInWindow, type DatedUsage, type MonthSlot } from "./window";

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

export type MonthPoint = MonthSlot & { used: number; pending: number };

/** One point per slot, zero-filled, so a person who took leave in one month still has twelve. */
export function monthlySeriesFor(
  usage: DatedUsage[],
  userId: string,
  slots: MonthSlot[],
  type: CalendarRecordType
): MonthPoint[] {
  const byKey = new Map<string, MonthPoint>(
    slots.map((slot) => [slotKey(slot.year, slot.month), { ...slot, used: 0, pending: 0 }])
  );
  for (const entry of usage) {
    if (entry.userId !== userId || entry.vacationType !== type) continue;
    const point = byKey.get(slotKey(entry.year, entry.month));
    if (!point) continue;
    point.used = round(point.used + entry.used);
    point.pending = round(point.pending + entry.pending);
  }
  return Array.from(byKey.values());
}

/** The year's grant plus carry-over of one allowance, across every group the person is in. */
export function totalQuotaFor(
  summary: ReportSummaryRow[],
  userId: string,
  type: CalendarRecordType
): number {
  return round(
    summary
      .filter((row) => row.userId === userId && row.vacationType === type)
      .reduce((total, row) => total + row.yearQuota + row.carriedOverDays, 0)
  );
}

/** Even pace only means something inside one allowance year, so a window across two has none. */
export function monthlyTargetFor(slots: MonthSlot[], quota: number): number {
  if (quota <= 0 || slots.length === 0) return 0;
  if (yearsInWindow(slots).length > 1) return 0;
  return quota / slots.length;
}
