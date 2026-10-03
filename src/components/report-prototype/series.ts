// PROTOTYPE (T-143, prototype/report): the pure parts of flexi-day/lib/report/series.ts and
// colors.ts, ported for the phone, plus the chart geometry.
import type { CalendarRecordType } from "@/lib/local-store";

import type { MonthlyUsage, ReportScopeMember, ReportSummaryRow } from "./types";

export type MonthSlot = { year: number; month: number };
export type DatedUsage = MonthlyUsage & { year: number };

export const MONTHS_SHORT = [
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
export const MONTHS_LONG = [
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

export const withYear = (year: number, rows: MonthlyUsage[]): DatedUsage[] =>
  rows.map((row) => ({ ...row, year }));

export const calendarMonths = (year: number): MonthSlot[] =>
  Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));

export function trailingMonths(today: Date, count = 12): MonthSlot[] {
  const slots: MonthSlot[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const date = new Date(today.getFullYear(), today.getMonth() - back, 1);
    slots.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
  }
  return slots;
}

export const yearsInWindow = (slots: MonthSlot[]): number[] =>
  Array.from(new Set(slots.map((slot) => slot.year))).sort((a, b) => a - b);

const slotKey = (year: number, month: number) => `${year}-${month}`;

export function windowLabel(slots: MonthSlot[]): string {
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (!first || !last) return "";
  if (first.year === last.year && first.month === 1 && last.month === 12) return String(first.year);
  const name = (slot: MonthSlot) => `${MONTHS_SHORT[slot.month - 1]} ${slot.year}`;
  return `${name(first)} to ${name(last)}`;
}

export type MonthPoint = MonthSlot & { used: number; pending: number };

export function monthlySeriesFor(
  rows: DatedUsage[],
  userId: string,
  slots: MonthSlot[],
  type: CalendarRecordType
): MonthPoint[] {
  const byKey = new Map<string, MonthPoint>(
    slots.map((slot) => [slotKey(slot.year, slot.month), { ...slot, used: 0, pending: 0 }])
  );
  for (const row of rows) {
    if (row.userId !== userId || row.vacationType !== type) continue;
    const point = byKey.get(slotKey(row.year, row.month));
    if (!point) continue;
    point.used += row.used;
    point.pending += row.pending;
  }
  return Array.from(byKey.values());
}

export function totalQuotaFor(
  summary: ReportSummaryRow[],
  userId: string,
  type: CalendarRecordType
): number {
  return summary
    .filter((row) => row.userId === userId && row.vacationType === type)
    .reduce((total, row) => total + row.yearQuota + row.carriedOverDays, 0);
}

export function activeRecordTypes(
  summary: ReportSummaryRow[],
  types?: CalendarRecordType[]
): CalendarRecordType[] {
  const wanted = types && types.length > 0 ? new Set(types) : null;
  const out: CalendarRecordType[] = [];
  for (const row of summary) {
    if (wanted && !wanted.has(row.vacationType)) continue;
    if (!out.includes(row.vacationType)) out.push(row.vacationType);
  }
  if (out.length === 0) out.push(...(types && types.length > 0 ? types : ["VACATION" as const]));
  const order = ["VACATION", "HOME_OFFICE", "SICK_DAY", "SICK", "PAID_TIME_OFF"];
  const rank = (type: string) => (order.includes(type) ? order.indexOf(type) : 99);
  return out.sort((a, b) => rank(a) - rank(b));
}

export function monthlyTargetFor(slots: MonthSlot[], quota: number): number {
  if (quota <= 0 || slots.length === 0) return 0;
  if (yearsInWindow(slots).length > 1) return 0;
  return quota / slots.length;
}

export type TeamMonthRow = MonthSlot & { values: Record<string, number> };

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
    row.values[entry.userId] = round((row.values[entry.userId] ?? 0) + entry.used + entry.pending);
  }
  return Array.from(byKey.values());
}

const round = (value: number) => Number(value.toFixed(2));

export type MemberRemaining = {
  member: ReportScopeMember;
  carriedOver: number;
  yearQuota: number;
  usedToDate: number;
  planned: number;
  used: number;
  pending: number;
  carriedOverLeft: number;
  yearLeft: number;
  overdraft: number;
  remaining: number;
};

export function uniqueMembers(members: ReportScopeMember[]): ReportScopeMember[] {
  const byId = new Map<string, ReportScopeMember>();
  for (const member of members) if (!byId.has(member.id)) byId.set(member.id, member);
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function remainingFor(
  member: ReportScopeMember,
  summary: ReportSummaryRow[],
  type: CalendarRecordType
): MemberRemaining {
  const rows = summary.filter((row) => row.userId === member.id && row.vacationType === type);
  const sum = (pick: (row: ReportSummaryRow) => number) =>
    round(rows.reduce((total, row) => total + pick(row), 0));
  const carriedOver = sum((row) => row.carriedOverDays);
  const yearQuota = sum((row) => row.yearQuota);
  const usedToDate = sum((row) => row.usedToDate);
  const planned = sum((row) => row.plannedRemaining);
  const used = round(usedToDate + planned);
  const carriedOverLeft = round(Math.max(0, carriedOver - used));
  const intoYearQuota = Math.max(0, used - carriedOver);
  const yearLeft = round(Math.max(0, yearQuota - intoYearQuota));
  const overdraft = round(-Math.max(0, intoYearQuota - yearQuota));
  return {
    member,
    carriedOver,
    yearQuota,
    usedToDate,
    planned,
    used,
    pending: sum((row) => row.pending),
    carriedOverLeft,
    yearLeft,
    overdraft,
    remaining: round(carriedOverLeft + yearLeft + overdraft),
  };
}

export function buildMemberRemaining(
  members: ReportScopeMember[],
  summary: ReportSummaryRow[],
  type: CalendarRecordType
): MemberRemaining[] {
  return uniqueMembers(members)
    .map((member) => remainingFor(member, summary, type))
    .sort((a, b) => b.remaining - a.remaining || a.member.name.localeCompare(b.member.name));
}

export const formatDays = (value: number): string =>
  Number.isInteger(value) ? value.toString() : value.toFixed(1);

// ---- colours (flexi-day/lib/report/colors.ts) ----

const CHART_FALLBACK_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function parseColor(color: string): Hsl | null {
  const match = /^hsl\(\s*(-?[\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*\)$/i.exec(
    color.trim()
  );
  if (match) {
    return { h: ((Number(match[1]) % 360) + 360) % 360, s: Number(match[2]), l: Number(match[3]) };
  }
  return hexToHsl(color);
}

function tooClose(a: Hsl, b: Hsl): boolean {
  const dh = Math.abs(a.h - b.h);
  const hueGap = Math.min(dh, 360 - dh);
  if (a.s < 12 && b.s < 12) return Math.abs(a.l - b.l) < 14;
  return hueGap < 30 && Math.abs(a.l - b.l) < 14;
}

export function assignMemberColors(members: ReportScopeMember[]): Record<string, string> {
  const taken: Hsl[] = [];
  const usedFallbacks = new Set<string>();
  const collides = (candidate: Hsl | null) =>
    candidate !== null && taken.some((existing) => tooClose(existing, candidate));
  const colors: Record<string, string> = {};
  for (const member of uniqueMembers(members)) {
    const avatar = parseColor(member.avatarColor);
    let color: string;
    let hsl: Hsl | null;
    if (avatar && !collides(avatar)) {
      color = member.avatarColor;
      hsl = avatar;
    } else {
      color =
        CHART_FALLBACK_COLORS.find((c) => !usedFallbacks.has(c) && !collides(hexToHsl(c))) ??
        CHART_FALLBACK_COLORS.find((c) => !usedFallbacks.has(c)) ??
        CHART_FALLBACK_COLORS[Object.keys(colors).length % CHART_FALLBACK_COLORS.length];
      usedFallbacks.add(color);
      hsl = hexToHsl(color);
    }
    if (hsl) taken.push(hsl);
    colors[member.id] = color;
  }
  return colors;
}

// ---- geometry ----

/** A rounded axis top and its gridline steps: 1, 2 or 5 times a power of ten. */
export function niceScale(max: number, targetTicks = 3): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 2, 4] };
  const raw = max / targetTicks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? power * 10);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(round(v));
  return { top, ticks };
}

/** Columns laid across a width with a gap between them. */
export function bands(count: number, width: number, gapRatio = 0.34) {
  const slot = width / Math.max(1, count);
  const bar = slot * (1 - gapRatio);
  return Array.from({ length: count }, (_, i) => ({
    x: i * slot + (slot - bar) / 2,
    width: bar,
    center: i * slot + slot / 2,
    slotX: i * slot,
    slotWidth: slot,
  }));
}

/** A bar with only its top corners rounded, for the top segment of a stack. */
export function roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return [
    `M${x},${y + h}`,
    `L${x},${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}

export function roundedRightRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, h / 2, w));
  return [
    `M${x},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h - rr}`,
    `Q${x + w},${y + h} ${x + w - rr},${y + h}`,
    `L${x},${y + h}`,
    "Z",
  ].join(" ");
}

export function axisLabel(slots: MonthSlot[], index: number): { month: string; year?: string } {
  const slot = slots[index];
  if (!slot) return { month: "" };
  const month = MONTHS_SHORT[slot.month - 1] ?? String(slot.month);
  if (yearsInWindow(slots).length < 2) return { month };
  if (index === 0 || slot.month === 1) return { month, year: `'${String(slot.year).slice(-2)}` };
  return { month };
}
