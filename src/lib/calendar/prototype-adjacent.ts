// PROTOTYPE (T-265): throwaway model for adjacent-month days in the month grid. Not for main.
import { useSyncExternalStore } from "react";

import { addDays, dayNumber, mondayIndex } from "@/lib/days";
import type { CalendarBankHoliday, ListedVacation } from "@/lib/local-store";
import type { CalendarRange } from "@/lib/calendar/lanes";
import { runKey } from "@/lib/requests/runs";
import { addMonths, isoDay, type YearMonth } from "@/lib/requests/months";

export type ProtoVariant = "A" | "B" | "C";
export type ProtoView = "lanes" | "stripes";

export const PROTO_VARIANT_LABELS: Record<ProtoVariant, string> = {
  A: "A — Quiet numbers",
  B: "B — Faded month",
  C: "C — Month seam",
};

type ProtoState = { variant: ProtoVariant; view: ProtoView };
let state: ProtoState = { variant: "A", view: "lanes" };
const listeners = new Set<() => void>();

export function setProtoState(next: Partial<ProtoState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function useProtoState(): ProtoState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );
}

/** Same as `CalendarRange`, but `from` and `to` are ISO days, so a range can span months. */
export type ProtoRange = Omit<CalendarRange, "from" | "to"> & { from: string; to: string };

export type ProtoCell = {
  iso: string;
  day: number;
  inMonth: boolean;
  /** Before the first day the sync pull reaches: the store holds nothing for it. */
  unsynced: boolean;
};
export type ProtoWeek = ProtoCell[];

export function paddedWeeks(month: YearMonth, syncedFrom: string): ProtoWeek[] {
  const first = isoDay(month, 1);
  const next = isoDay(addMonths(month, 1), 1);
  const { from, until } = paddedRange(month);
  const weeks: ProtoWeek[] = [];
  for (let iso = from; iso < until; iso = addDays(iso, 1)) {
    if (mondayIndex(iso) === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      iso,
      day: Number(iso.slice(8, 10)),
      inMonth: iso >= first && iso < next,
      unsynced: iso < syncedFrom,
    });
  }
  return weeks;
}

/** First visible cell up to, not including, the day after the last visible cell. */
export function paddedRange(month: YearMonth): { from: string; until: string } {
  const first = isoDay(month, 1);
  const lastDay = addDays(isoDay(addMonths(month, 1), 1), -1);
  return {
    from: addDays(first, -mondayIndex(first)),
    until: addDays(lastDay, 7 - mondayIndex(lastDay)),
  };
}

const isNextDay = (previous: string, next: string) => dayNumber(next) - dayNumber(previous) === 1;

export function protoGroupRows(rows: readonly ListedVacation[]): ProtoRange[] {
  const sorted = rows
    .map((row) => ({ row, key: runKey(row) }))
    .sort((a, b) =>
      a.key !== b.key ? (a.key < b.key ? -1 : 1) : a.row.requestedDay < b.row.requestedDay ? -1 : 1
    );
  const ranges: ProtoRange[] = [];
  let current: ProtoRange | null = null;
  let lastKey: string | null = null;
  let lastDay: string | null = null;
  for (const { row, key } of sorted) {
    if (current && key === lastKey && lastDay && isNextDay(lastDay, row.requestedDay)) {
      current.to = row.requestedDay;
      current.vacationIds.push(row.id);
      current.pending ||= row.pending;
    } else {
      current = {
        id: `${key}|${row.id}`,
        userId: row.userId,
        userName: row.userName,
        type: row.vacationType,
        status: row.status,
        halfDay: row.halfDay,
        from: row.requestedDay,
        to: row.requestedDay,
        vacationIds: [row.id],
        names: [],
        pending: row.pending,
      };
      ranges.push(current);
    }
    lastKey = key;
    lastDay = row.requestedDay;
  }
  return ranges;
}

export function protoBankRanges(holidays: readonly CalendarBankHoliday[]): ProtoRange[] {
  const namesByDate = new Map<string, string[]>();
  for (const holiday of holidays) {
    const names = namesByDate.get(holiday.date) ?? [];
    if (!names.includes(holiday.name)) names.push(holiday.name);
    namesByDate.set(holiday.date, names);
  }
  const ranges: ProtoRange[] = [];
  let current: ProtoRange | null = null;
  let lastDate: string | null = null;
  for (const [date, names] of [...namesByDate].sort(([a], [b]) => a.localeCompare(b))) {
    if (current && lastDate && isNextDay(lastDate, date)) {
      current.to = date;
      current.names.push(...names);
    } else {
      current = {
        id: `bank|${date}`,
        userId: null,
        userName: null,
        type: "BANK_HOLIDAY",
        status: "approved",
        halfDay: false,
        from: date,
        to: date,
        vacationIds: [],
        names: [...names],
        pending: false,
      };
      ranges.push(current);
    }
    lastDate = date;
  }
  return ranges;
}

const FIXTURE_PREFIX = "prototype-";
export const isFixture = (range: ProtoRange) => range.id.startsWith(FIXTURE_PREFIX);

/**
 * PROTOTYPE fixtures: bookings on the month boundaries, which the dev scenario rarely has. Clipped
 * to the synced days, since the store can never hold a row before them.
 */
export function protoFixtures(
  month: YearMonth,
  viewer: { id: string | null; name: string | null },
  syncedFrom: string
): ProtoRange[] {
  const { from: gridFrom, until } = paddedRange(month);
  const gridTo = addDays(until, -1);
  const first = isoDay(month, 1);
  const last = addDays(isoDay(addMonths(month, 1), 1), -1);
  const base = {
    halfDay: false,
    names: [],
    pending: false,
  };
  const make = (
    key: string,
    range: Pick<ProtoRange, "userId" | "userName" | "type" | "status" | "from" | "to">
  ): ProtoRange | null => {
    const from = range.from < syncedFrom ? syncedFrom : range.from;
    if (from > range.to) return null;
    return {
      ...base,
      ...range,
      from,
      id: FIXTURE_PREFIX + key,
      vacationIds: [FIXTURE_PREFIX + key],
    };
  };
  const leadFrom = addDays(first, -2) < gridFrom ? gridFrom : addDays(first, -2);
  const trailing = gridTo > last ? addDays(last, 1) : last;
  const trailingWeekday =
    gridTo > last
      ? (Array.from({ length: dayNumber(gridTo) - dayNumber(last) }, (_, i) =>
          addDays(last, i + 1)
        ).find((iso) => mondayIndex(iso) < 5) ?? trailing)
      : last;
  const crossTo = addDays(last, 2) > gridTo ? gridTo : addDays(last, 2);
  return [
    make("lead", {
      userId: viewer.id,
      userName: viewer.name,
      type: "VACATION",
      status: "approved",
      from: leadFrom,
      to: addDays(first, 1),
    }),
    make("pending", {
      userId: "prototype-alex",
      userName: "Alex Pending",
      type: "HOME_OFFICE",
      status: "pending",
      from: trailingWeekday,
      to: trailingWeekday,
    }),
    make("cross", {
      userId: "prototype-pat",
      userName: "Pat Crossing",
      type: "PAID_TIME_OFF",
      status: "approved",
      from: addDays(last, -1),
      to: crossTo,
    }),
  ].filter((range): range is ProtoRange => range !== null);
}

export type ProtoPlacedBar = {
  range: ProtoRange;
  startColumn: number;
  endColumn: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  lane: number;
};

/** `placeWeek` on ISO days: the week's seven cells are all real days now. */
export function protoPlaceWeek(
  week: ProtoWeek,
  ranges: readonly ProtoRange[],
  { maxLanes, viewerId }: { maxLanes: number; viewerId: string | null }
) {
  const weekStart = week[0].iso;
  const weekEnd = week[6].iso;
  const column = (iso: string) => dayNumber(iso) - dayNumber(weekStart);
  const place = (range: ProtoRange): ProtoPlacedBar => ({
    range,
    startColumn: column(range.from > weekStart ? range.from : weekStart),
    endColumn: column(range.to < weekEnd ? range.to : weekEnd) + 1,
    continuesLeft: range.from < weekStart,
    continuesRight: range.to > weekEnd,
    lane: 0,
  });

  const inWeek = ranges.filter((range) => range.from <= weekEnd && range.to >= weekStart);
  const bank = inWeek.filter((range) => range.type === "BANK_HOLIDAY").map(place);
  const viewerFirst = (bar: ProtoPlacedBar) => (viewerId && bar.range.userId === viewerId ? 0 : 1);
  const bars = inWeek
    .filter((range) => range.type !== "BANK_HOLIDAY")
    .map(place)
    .sort(
      (a, b) =>
        viewerFirst(a) - viewerFirst(b) ||
        a.startColumn - b.startColumn ||
        b.endColumn - b.startColumn - (a.endColumn - a.startColumn)
    );
  const lanes: ProtoPlacedBar[][] = [];
  for (const bar of bars) {
    const free = lanes.findIndex((lane) =>
      lane.every(
        (other) => bar.startColumn >= other.endColumn || bar.endColumn <= other.startColumn
      )
    );
    bar.lane = free >= 0 ? free : lanes.length;
    if (free >= 0) lanes[free].push(bar);
    else lanes.push([bar]);
  }
  const bankRows = bank.length > 0 ? 1 : 0;
  const shownLanes = Math.max(0, maxLanes - bankRows);
  const hidden = new Map<number, ProtoRange[]>();
  for (const bar of bars) {
    if (bar.lane < shownLanes) continue;
    for (let c = bar.startColumn; c < bar.endColumn; c++) {
      hidden.set(c, [...(hidden.get(c) ?? []), bar.range]);
    }
  }
  return {
    bank,
    shown: bars.filter((bar) => bar.lane < shownLanes),
    hidden: new Map([...hidden].sort(([a], [b]) => a - b)),
    bankRows,
  };
}

export type ProtoSegment = ProtoPlacedBar & { outside: boolean };

/**
 * Variant B: a bar cut where the week crosses the month boundary. The pieces meet with square
 * ends, so the booking still reads as one.
 */
export function splitAtBoundary(bar: ProtoPlacedBar, week: ProtoWeek): ProtoSegment[] {
  const segments: ProtoSegment[] = [];
  let start = bar.startColumn;
  for (let c = bar.startColumn + 1; c <= bar.endColumn; c++) {
    if (c === bar.endColumn || week[c].inMonth !== week[start].inMonth) {
      segments.push({
        ...bar,
        startColumn: start,
        endColumn: c,
        continuesLeft: start === bar.startColumn ? bar.continuesLeft : true,
        continuesRight: c === bar.endColumn ? bar.continuesRight : true,
        outside: !week[start].inMonth,
      });
      start = c;
    }
  }
  return segments;
}

/** The column where the week switches month, if it does mid-week. */
export function seamColumn(week: ProtoWeek): number | null {
  for (let c = 1; c < 7; c++) if (week[c].inMonth !== week[c - 1].inMonth) return c;
  return null;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Variant C: the first adjacent cell on each side carries its month's short name. */
export function seamLabel(week: ProtoWeek, column: number, weekIndex: number): string | null {
  const cell = week[column];
  if (cell.inMonth) return null;
  const leading = weekIndex === 0;
  const labelled = leading ? column === 0 : column === 0 || week[column - 1].inMonth;
  return labelled ? MONTHS_SHORT[Number(cell.iso.slice(5, 7)) - 1] : null;
}
