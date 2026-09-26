// PROTOTYPE (T-34): throwaway fixtures and the web's lane logic, ported loosely. Never import from app code.

export type LeaveType =
  | "VACATION"
  | "HOME_OFFICE"
  | "SICK"
  | "SICK_DAY"
  | "PAID_TIME_OFF"
  | "NON_PAID_LEAVE"
  | "STUDY_LEAVE"
  | "BANK_HOLIDAY"
  | "OTHER";

export const TYPE_ORDER: LeaveType[] = [
  "VACATION",
  "HOME_OFFICE",
  "SICK",
  "SICK_DAY",
  "BANK_HOLIDAY",
  "PAID_TIME_OFF",
  "NON_PAID_LEAVE",
  "STUDY_LEAVE",
  "OTHER",
];

export const TYPE_LABEL: Record<LeaveType, string> = {
  VACATION: "Vacation",
  HOME_OFFICE: "Home office",
  SICK: "Sick",
  SICK_DAY: "Sick day",
  BANK_HOLIDAY: "Bank holiday",
  PAID_TIME_OFF: "Paid time off",
  NON_PAID_LEAVE: "Non-paid leave",
  STUDY_LEAVE: "Study leave",
  OTHER: "Other",
};

// Literal class names: NativeWind only compiles what it can find verbatim in the source.
export const BG: Record<LeaveType, string> = {
  VACATION: "bg-leave-vacation",
  HOME_OFFICE: "bg-leave-home",
  SICK: "bg-leave-sick",
  SICK_DAY: "bg-leave-sickday",
  BANK_HOLIDAY: "bg-leave-bank",
  PAID_TIME_OFF: "bg-leave-pto",
  NON_PAID_LEAVE: "bg-leave-nonpaid",
  STUDY_LEAVE: "bg-leave-study",
  OTHER: "bg-leave-other",
};
export const TEXT: Record<LeaveType, string> = {
  VACATION: "text-leave-vacation",
  HOME_OFFICE: "text-leave-home",
  SICK: "text-leave-sick",
  SICK_DAY: "text-leave-sickday",
  BANK_HOLIDAY: "text-leave-bank",
  PAID_TIME_OFF: "text-leave-pto",
  NON_PAID_LEAVE: "text-leave-nonpaid",
  STUDY_LEAVE: "text-leave-study",
  OTHER: "text-leave-other",
};
export const BORDER: Record<LeaveType, string> = {
  VACATION: "border-leave-vacation",
  HOME_OFFICE: "border-leave-home",
  SICK: "border-leave-sick",
  SICK_DAY: "border-leave-sickday",
  BANK_HOLIDAY: "border-leave-bank",
  PAID_TIME_OFF: "border-leave-pto",
  NON_PAID_LEAVE: "border-leave-nonpaid",
  STUDY_LEAVE: "border-leave-study",
  OTHER: "border-leave-other",
};

export type Person = { id: string; name: string; initials: string; color: string };

export const VIEWER_ID = "u-daniel";

export const PEOPLE: Person[] = [
  { id: VIEWER_ID, name: "Daniel Hrynusiw", initials: "DH", color: "#6a5ec6" },
  { id: "u-tereza", name: "Tereza Nováková", initials: "TN", color: "#c0607a" },
  { id: "u-jakub", name: "Jakub Dvořák", initials: "JD", color: "#3f8f7a" },
  { id: "u-lucie", name: "Lucie Horáková", initials: "LH", color: "#c7823a" },
  { id: "u-martin", name: "Martin Svoboda", initials: "MS", color: "#4a78b8" },
  { id: "u-eva", name: "Eva Černá", initials: "EČ", color: "#8a6bb0" },
  { id: "u-ondrej", name: "Ondřej Procházka", initials: "OP", color: "#5c8a3a" },
  { id: "u-klara", name: "Klára Veselá", initials: "KV", color: "#b0584a" },
];
export const personById = (id: string) => PEOPLE.find((p) => p.id === id)!;

export type Group = { id: string; name: string; members: string[] };
export const GROUPS: Group[] = [
  {
    id: "g-design",
    name: "Design",
    members: [VIEWER_ID, "u-tereza", "u-jakub", "u-lucie", "u-martin", "u-klara"],
  },
  {
    id: "g-platform",
    name: "Platform",
    members: [VIEWER_ID, "u-eva", "u-ondrej", "u-klara", "u-jakub", "u-martin", "u-lucie"],
  },
];

type Status = "approved" | "pending";

// A request as the viewer typed it; expanded into per-day rows below, the way the store holds them.
type Booking = {
  id: string;
  user: string;
  type: Exclude<LeaveType, "BANK_HOLIDAY">;
  from: string;
  to: string;
  status?: Status;
  halfDay?: boolean;
  note?: string;
};

// "Today" is pinned so the stat strip has something to count on a Saturday.
export const TODAY = "2026-09-24";

export const HOLIDAYS: { date: string; name: string }[] = [
  { date: "2026-09-28", name: "Statehood Day" },
  { date: "2026-10-28", name: "Independent Czechoslovak State Day" },
  { date: "2026-11-17", name: "Struggle for Freedom and Democracy Day" },
  { date: "2026-12-24", name: "Christmas Eve" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "St Stephen's Day" },
  { date: "2027-01-01", name: "New Year's Day" },
];

const BOOKINGS: Booking[] = [
  // September
  { id: "v1", user: "u-eva", type: "VACATION", from: "2026-09-07", to: "2026-09-11" },
  { id: "v2", user: VIEWER_ID, type: "SICK_DAY", from: "2026-09-08", to: "2026-09-08" },
  {
    id: "v3",
    user: "u-lucie",
    type: "HOME_OFFICE",
    from: "2026-09-16",
    to: "2026-09-16",
    halfDay: true,
  },
  { id: "v4", user: "u-martin", type: "VACATION", from: "2026-09-21", to: "2026-09-25" },
  { id: "v5", user: VIEWER_ID, type: "HOME_OFFICE", from: "2026-09-23", to: "2026-09-23" },
  {
    id: "v6",
    user: "u-tereza",
    type: "OTHER",
    from: "2026-09-24",
    to: "2026-09-24",
    note: "Doctor",
  },
  { id: "v7", user: "u-klara", type: "NON_PAID_LEAVE", from: "2026-09-22", to: "2026-09-24" },
  { id: "v8", user: "u-ondrej", type: "HOME_OFFICE", from: "2026-09-24", to: "2026-09-24" },
  // Crosses a bank holiday, a weekend and the month boundary.
  { id: "v9", user: "u-jakub", type: "VACATION", from: "2026-09-29", to: "2026-10-09" },
  { id: "v10", user: "u-lucie", type: "SICK", from: "2026-09-30", to: "2026-10-02" },
  // The dense week: seven people on Wednesday 14 October.
  { id: "v11", user: VIEWER_ID, type: "VACATION", from: "2026-10-14", to: "2026-10-16" },
  { id: "v12", user: "u-tereza", type: "VACATION", from: "2026-10-12", to: "2026-10-16" },
  { id: "v13", user: "u-jakub", type: "HOME_OFFICE", from: "2026-10-14", to: "2026-10-14" },
  { id: "v14", user: "u-lucie", type: "SICK", from: "2026-10-13", to: "2026-10-15" },
  {
    id: "v15",
    user: "u-martin",
    type: "PAID_TIME_OFF",
    from: "2026-10-14",
    to: "2026-10-15",
    status: "pending",
  },
  { id: "v16", user: "u-eva", type: "STUDY_LEAVE", from: "2026-10-14", to: "2026-10-14" },
  { id: "v17", user: "u-ondrej", type: "HOME_OFFICE", from: "2026-10-12", to: "2026-10-12" },
  { id: "v18", user: "u-ondrej", type: "HOME_OFFICE", from: "2026-10-14", to: "2026-10-14" },
  { id: "v19", user: "u-ondrej", type: "HOME_OFFICE", from: "2026-10-16", to: "2026-10-16" },
  {
    id: "v20",
    user: "u-klara",
    type: "VACATION",
    from: "2026-10-15",
    to: "2026-10-15",
    halfDay: true,
  },
  { id: "v21", user: "u-martin", type: "VACATION", from: "2026-10-26", to: "2026-10-30" },
  // November
  { id: "v22", user: "u-ondrej", type: "VACATION", from: "2026-11-02", to: "2026-11-06" },
  { id: "v23", user: "u-lucie", type: "HOME_OFFICE", from: "2026-11-16", to: "2026-11-18" },
  {
    id: "v24",
    user: VIEWER_ID,
    type: "VACATION",
    from: "2026-11-23",
    to: "2026-11-27",
    status: "pending",
  },
  {
    id: "v25",
    user: "u-eva",
    type: "STUDY_LEAVE",
    from: "2026-11-09",
    to: "2026-11-10",
    status: "pending",
  },
  // December into January
  {
    id: "v26",
    user: "u-klara",
    type: "VACATION",
    from: "2026-12-21",
    to: "2027-01-08",
    status: "pending",
  },
  { id: "v27", user: VIEWER_ID, type: "VACATION", from: "2026-12-28", to: "2026-12-31" },
  { id: "v28", user: "u-tereza", type: "SICK", from: "2026-12-14", to: "2026-12-15" },
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) =>
  new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const holidaySet = new Set(HOLIDAYS.map((h) => h.date));

export type DayRow = {
  id: string;
  bookingId: string;
  user: string;
  type: LeaveType;
  day: string;
  status: Status;
  halfDay: boolean;
  note?: string;
};

// The store's shape: one row per requested business day.
export const ROWS: DayRow[] = BOOKINGS.flatMap((b) => {
  const out: DayRow[] = [];
  for (let d = parse(b.from); d <= parse(b.to); d.setDate(d.getDate() + 1)) {
    const day = iso(d);
    if (d.getDay() === 0 || d.getDay() === 6 || holidaySet.has(day)) continue;
    out.push({
      id: `${b.id}-${day}`,
      bookingId: b.id,
      user: b.user,
      type: b.type,
      day,
      status: b.status ?? "approved",
      halfDay: Boolean(b.halfDay),
      note: b.note,
    });
  }
  return out;
});

export type Range = {
  id: string;
  user: string | null; // null = bank holiday
  type: LeaveType;
  from: number; // day of month
  to: number;
  status: Status;
  halfDay: boolean;
  names?: string[];
  note?: string;
  bookingId?: string;
  firstIso: string;
};

export type Scope = { kind: "mine" } | { kind: "group"; groupId: string };

export function rowsInScope(scope: Scope): DayRow[] {
  if (scope.kind === "mine") return ROWS.filter((r) => r.user === VIEWER_ID);
  const g = GROUPS.find((x) => x.id === scope.groupId)!;
  return ROWS.filter((r) => g.members.includes(r.user));
}

const nextDay = (a: string, b: string) => parse(b).getTime() - parse(a).getTime() === 86_400_000;

/** The web's groupConsecutiveByUserType, plus bankHolidaysToRanges, clipped to one month. */
export function monthRanges(year: number, month: number, scope: Scope): Range[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const rows = rowsInScope(scope)
    .filter((r) => r.day.startsWith(prefix))
    .sort((a, b) =>
      a.user !== b.user
        ? a.user < b.user
          ? -1
          : 1
        : a.bookingId !== b.bookingId
          ? a.bookingId < b.bookingId
            ? -1
            : 1
          : a.day < b.day
            ? -1
            : 1
    );
  const ranges: Range[] = [];
  let cur: Range | null = null;
  let last: DayRow | null = null;
  for (const r of rows) {
    const day = Number(r.day.slice(8));
    if (cur && last && last.bookingId === r.bookingId && nextDay(last.day, r.day)) {
      cur.to = day;
    } else {
      cur = {
        id: r.id,
        user: r.user,
        type: r.type,
        from: day,
        to: day,
        status: r.status,
        halfDay: r.halfDay,
        note: r.note,
        bookingId: r.bookingId,
        firstIso: r.day,
      };
      ranges.push(cur);
    }
    last = r;
  }
  const hol = HOLIDAYS.filter((h) => h.date.startsWith(prefix));
  let hcur: Range | null = null;
  let hlast: string | null = null;
  for (const h of hol) {
    const day = Number(h.date.slice(8));
    if (hcur && hlast && nextDay(hlast, h.date)) {
      hcur.to = day;
      hcur.names!.push(h.name);
    } else {
      hcur = {
        id: `hol-${h.date}`,
        user: null,
        type: "BANK_HOLIDAY",
        from: day,
        to: day,
        status: "approved",
        halfDay: false,
        names: [h.name],
        firstIso: h.date,
      };
      ranges.push(hcur);
    }
    hlast = h.date;
  }
  return ranges;
}

export function buildWeeks(year: number, month: number): (number | null)[][] {
  const days = new Date(year, month, 0).getDate();
  const first = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type Placed = {
  range: Range;
  sc: number; // 0-based column
  ec: number; // exclusive
  contL: boolean;
  contR: boolean;
  lane: number;
};

/** The web's per-week lane packing: bank holidays share one lane, then MAX lanes, the rest per column. */
export function placeWeek(week: (number | null)[], ranges: Range[], maxLanes: number) {
  const days = week.filter((d): d is number => d !== null);
  const ws = days[0];
  const we = days[days.length - 1];
  const place = (e: Range): Placed => {
    const cf = Math.max(e.from, ws);
    const ct = Math.min(e.to, we);
    return {
      range: e,
      sc: week.indexOf(cf),
      ec: week.indexOf(ct) + 1,
      contL: e.from < ws,
      contR: e.to > we,
      lane: 0,
    };
  };
  const inWeek = ranges.filter((e) => e.from <= we && e.to >= ws);
  const bank = inWeek.filter((e) => e.type === "BANK_HOLIDAY").map(place);
  const bars = inWeek
    .filter((e) => e.type !== "BANK_HOLIDAY")
    .map(place)
    .sort((a, b) => a.sc - b.sc || b.ec - b.sc - (a.ec - a.sc));
  const lanes: Placed[][] = [];
  for (const b of bars) {
    const li = lanes.findIndex((lane) => lane.every((x) => b.sc >= x.ec || b.ec <= x.sc));
    if (li >= 0) {
      lanes[li].push(b);
      b.lane = li;
    } else {
      b.lane = lanes.length;
      lanes.push([b]);
    }
  }
  const bankRows = bank.length > 0 ? 1 : 0;
  const shownLanes = Math.max(0, maxLanes - bankRows);
  const hidden = new Map<number, Range[]>();
  for (const b of bars) {
    if (b.lane < shownLanes) continue;
    for (let c = b.sc; c < b.ec; c++) hidden.set(c, [...(hidden.get(c) ?? []), b.range]);
  }
  return { bank, shown: bars.filter((b) => b.lane < shownLanes), all: bars, hidden, bankRows };
}

export const MONTHS: { year: number; month: number }[] = [
  { year: 2026, month: 8 },
  { year: 2026, month: 9 },
  { year: 2026, month: 10 },
  { year: 2026, month: 11 },
  { year: 2026, month: 12 },
  { year: 2027, month: 1 },
];
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const isoOf = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Everyone on one day, holidays first, for the day sheet and variant B's agenda. */
export function dayEntries(dayIso: string, scope: Scope, filter: Set<LeaveType>) {
  const holidays = filter.has("BANK_HOLIDAY") ? HOLIDAYS.filter((h) => h.date === dayIso) : [];
  const rows = rowsInScope(scope).filter((r) => r.day === dayIso && filter.has(r.type));
  rows.sort((a, b) =>
    a.user === VIEWER_ID ? -1 : b.user === VIEWER_ID ? 1 : a.user < b.user ? -1 : 1
  );
  return { holidays, rows };
}

/** The whole booking a day row belongs to, for "14–16 Oct"-style labels. */
export function bookingSpan(bookingId: string) {
  const days = ROWS.filter((r) => r.bookingId === bookingId).map((r) => r.day);
  return { from: days[0], to: days[days.length - 1], count: days.length };
}

export function formatSpan(from: string, to: string) {
  const f = parse(from);
  const t = parse(to);
  if (from === to) return `${f.getDate()} ${MONTH_SHORT[f.getMonth()]}`;
  if (f.getMonth() === t.getMonth())
    return `${f.getDate()}-${t.getDate()} ${MONTH_SHORT[f.getMonth()]}`;
  return `${f.getDate()} ${MONTH_SHORT[f.getMonth()]} - ${t.getDate()} ${MONTH_SHORT[t.getMonth()]}`;
}

export function formatDay(dayIso: string) {
  const d = parse(dayIso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** Stat strip numbers. Out today and working today are per scope; the web counts them server-side. */
export function stats(scope: Scope) {
  const rows = rowsInScope(scope === undefined ? { kind: "mine" } : scope);
  const team =
    scope.kind === "group" ? GROUPS.find((g) => g.id === scope.groupId)!.members : [VIEWER_ID];
  const outToday = new Set(
    rows
      .filter((r) => r.day === TODAY && r.status === "approved" && r.type !== "HOME_OFFICE")
      .map((r) => r.user)
  ).size;
  const horizon = iso(new Date(parse(TODAY).getTime() + 14 * 86_400_000));
  const comingUp = new Set(
    rows.filter((r) => r.day > TODAY && r.day <= horizon).map((r) => r.bookingId)
  ).size;
  return { outToday, comingUp, workingToday: team.length - outToday };
}

export type Approval = {
  bookingId: string;
  user: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
};

/** What `/me/approvals` would answer: other people's pending requests. */
export const APPROVALS: Approval[] = BOOKINGS.filter(
  (b) => b.status === "pending" && b.user !== VIEWER_ID
).map((b) => {
  const span = bookingSpan(b.id);
  return {
    bookingId: b.id,
    user: b.user,
    type: b.type,
    from: span.from,
    to: span.to,
    days: span.count,
  };
});

export const BALANCE = [
  { type: "VACATION" as LeaveType, used: 14, allocated: 25, pending: 5 },
  { type: "HOME_OFFICE" as LeaveType, used: 31, allocated: 48, pending: 0 },
  { type: "SICK_DAY" as LeaveType, used: 1, allocated: 5, pending: 0 },
];
