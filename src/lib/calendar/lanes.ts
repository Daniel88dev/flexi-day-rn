import { dayNumber } from "@/lib/days";
import type {
  CalendarBankHoliday,
  CalendarRecordType,
  ListedVacation,
  VacationStatus,
} from "@/lib/local-store";
import { runKey } from "@/lib/requests/runs";
import type { YearMonth } from "@/lib/requests/months";

export type CalendarRow = Pick<
  ListedVacation,
  | "id"
  | "userId"
  | "userName"
  | "groupId"
  | "vacationType"
  | "status"
  | "halfDay"
  | "startTime"
  | "endTime"
  | "requestedDay"
>;

/** `from` and `to` are days of the month. A bank holiday has no person; `names` are its holidays. */
export type CalendarRange = {
  id: string;
  userId: string | null;
  userName: string | null;
  type: CalendarRecordType;
  status: VacationStatus;
  halfDay: boolean;
  from: number;
  to: number;
  vacationIds: string[];
  names: string[];
};

/** Monday first; null pads the days outside the month. */
export type Week = (number | null)[];

export function buildWeeks({ year, month }: YearMonth): Week[] {
  const days = new Date(year, month, 0).getDate();
  const first = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: Week = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let day = 1; day <= days; day++) cells.push(day);
  while (cells.length % 7) cells.push(null);
  const weeks: Week[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const isNextDay = (previous: string, next: string) => dayNumber(next) - dayNumber(previous) === 1;

const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));

/**
 * The web's `groupConsecutiveByUserType`, keyed by the Requests list's run key rather than user and
 * type: the status and the half day are marked on the bar, and the group keeps a mirrored row off
 * the viewer's own.
 */
export function groupConsecutiveByRunKey(rows: readonly CalendarRow[]): CalendarRange[] {
  const sorted = rows
    .map((row) => ({ row, key: runKey(row) }))
    .sort((a, b) =>
      a.key !== b.key ? (a.key < b.key ? -1 : 1) : a.row.requestedDay < b.row.requestedDay ? -1 : 1
    );

  const ranges: CalendarRange[] = [];
  let current: CalendarRange | null = null;
  let lastKey: string | null = null;
  let lastDay: string | null = null;
  for (const { row, key } of sorted) {
    if (current && key === lastKey && lastDay && isNextDay(lastDay, row.requestedDay)) {
      current.to = dayOfMonth(row.requestedDay);
      current.vacationIds.push(row.id);
    } else {
      current = {
        id: `${key}|${row.requestedDay}`,
        userId: row.userId,
        userName: row.userName,
        type: row.vacationType,
        status: row.status,
        halfDay: row.halfDay,
        from: dayOfMonth(row.requestedDay),
        to: dayOfMonth(row.requestedDay),
        vacationIds: [row.id],
        names: [],
      };
      ranges.push(current);
    }
    lastKey = key;
    lastDay = row.requestedDay;
  }
  return ranges;
}

/**
 * One pill per run of consecutive holidays, where the web has one per date. The same date in
 * several countries is one day, since every pill shares one lane.
 */
export function bankHolidaysToRanges(
  holidays: readonly CalendarBankHoliday[],
  { year, month }: YearMonth
): CalendarRange[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const namesByDate = new Map<string, string[]>();
  for (const holiday of holidays) {
    if (!holiday.date.startsWith(prefix)) continue;
    const names = namesByDate.get(holiday.date) ?? [];
    if (!names.includes(holiday.name)) names.push(holiday.name);
    namesByDate.set(holiday.date, names);
  }

  const ranges: CalendarRange[] = [];
  let current: CalendarRange | null = null;
  let lastDate: string | null = null;
  for (const [date, names] of [...namesByDate].sort(([a], [b]) => a.localeCompare(b))) {
    if (current && lastDate && isNextDay(lastDate, date)) {
      current.to = dayOfMonth(date);
      current.names.push(...names);
    } else {
      current = {
        id: `bank|${date}`,
        userId: null,
        userName: null,
        type: "BANK_HOLIDAY",
        status: "approved",
        halfDay: false,
        from: dayOfMonth(date),
        to: dayOfMonth(date),
        vacationIds: [],
        names: [...names],
      };
      ranges.push(current);
    }
    lastDate = date;
  }
  return ranges;
}

/** A range placed on one week: columns 0-6, the end exclusive, and the lane it packed into. */
export type PlacedBar = {
  range: CalendarRange;
  startColumn: number;
  endColumn: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  lane: number;
};

export type PlacedWeek = {
  bank: PlacedBar[];
  shown: PlacedBar[];
  hidden: Map<number, CalendarRange[]>;
  bankRows: 0 | 1;
};

/**
 * The web's per-week lane packing: bank holidays share one lane of the budget, bars pack greedily
 * into the rest, and each column lists what it dropped. The viewer's own bars pack first, so
 * "You" is never the one behind "+N".
 */
export function placeWeek(
  week: Week,
  ranges: readonly CalendarRange[],
  { maxLanes, viewerId }: { maxLanes: number; viewerId: string | null }
): PlacedWeek {
  const days = week.filter((day): day is number => day !== null);
  const weekStart = days[0];
  const weekEnd = days[days.length - 1];

  const place = (range: CalendarRange): PlacedBar => ({
    range,
    startColumn: week.indexOf(Math.max(range.from, weekStart)),
    endColumn: week.indexOf(Math.min(range.to, weekEnd)) + 1,
    continuesLeft: range.from < weekStart,
    continuesRight: range.to > weekEnd,
    lane: 0,
  });

  const inWeek = ranges.filter((range) => range.from <= weekEnd && range.to >= weekStart);
  const bank = inWeek.filter((range) => range.type === "BANK_HOLIDAY").map(place);
  const viewerFirst = (bar: PlacedBar) => (viewerId && bar.range.userId === viewerId ? 0 : 1);
  const bars = inWeek
    .filter((range) => range.type !== "BANK_HOLIDAY")
    .map(place)
    .sort(
      (a, b) =>
        viewerFirst(a) - viewerFirst(b) ||
        a.startColumn - b.startColumn ||
        b.endColumn - b.startColumn - (a.endColumn - a.startColumn)
    );

  const lanes: PlacedBar[][] = [];
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
  const hidden = new Map<number, CalendarRange[]>();
  for (const bar of bars) {
    if (bar.lane < shownLanes) continue;
    for (let column = bar.startColumn; column < bar.endColumn; column++) {
      hidden.set(column, [...(hidden.get(column) ?? []), bar.range]);
    }
  }

  return {
    bank,
    shown: bars.filter((bar) => bar.lane < shownLanes),
    hidden: new Map([...hidden].sort(([a], [b]) => a - b)),
    bankRows,
  };
}
