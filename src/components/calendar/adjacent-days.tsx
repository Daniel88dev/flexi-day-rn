import { View } from "react-native";

import type { Dictionary } from "@/i18n";
import { dayParts } from "@/lib/calendar/day";
import { seamColumn, type Week } from "@/lib/calendar/month-grid";

/** Lighter than a weekend number, which is already `text-faint`. */
export const ADJACENT_NUMBER_OPACITY = 0.55;

const SEAM_WIDTH = 1.5;

export function fadesNumber({ inMonth, highlighted }: { inMonth: boolean; highlighted: boolean }) {
  return !inMonth && !highlighted;
}

export function monthShortName(t: Dictionary, date: string): string {
  return t.calendar.monthsShort[dayParts(date).date.month - 1];
}

export function MonthSeam({ week, cellWidth }: { week: Week; cellWidth: number }) {
  const column = seamColumn(week);
  if (column === null) return null;
  return (
    <View
      testID={`calendar-seam-${week[column].date}`}
      pointerEvents="none"
      className="absolute bg-input"
      style={{ left: column * cellWidth - SEAM_WIDTH / 2, width: SEAM_WIDTH, top: 0, bottom: 0 }}
    />
  );
}
