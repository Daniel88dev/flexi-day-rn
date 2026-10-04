import type { CalendarRecordType } from "@/lib/local-store";

import { round } from "./round";
import type { ReportScopeMember, ReportSummaryRow } from "./types";

export type MemberRemaining = {
  member: ReportScopeMember;
  carriedOver: number;
  yearQuota: number;
  usedToDate: number;
  planned: number;
  pending: number;
  carriedOverLeft: number;
  yearLeft: number;
  /** Zero or negative, so it stacks left of zero. */
  overdraft: number;
  remaining: number;
};

/** Each person once, by name then id: a person in two groups appears in the scope twice. */
export function uniqueMembers(members: ReportScopeMember[]): ReportScopeMember[] {
  const byId = new Map<string, ReportScopeMember>();
  for (const member of members) if (!byId.has(member.id)) byId.set(member.id, member);
  return Array.from(byId.values()).sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );
}

/**
 * Carry-over is drawn down before the year's own grant, the order the days expire in, and
 * anything past both is an overdraft. Approved days count, used or still ahead; pending ones
 * do not draw the allowance down.
 */
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
  const taken = usedToDate + planned;
  const carriedOverLeft = round(Math.max(0, carriedOver - taken));
  const intoYearQuota = Math.max(0, taken - carriedOver);
  const yearLeft = round(Math.max(0, yearQuota - intoYearQuota));
  const overdraft = round(-Math.max(0, intoYearQuota - yearQuota));

  return {
    member,
    carriedOver,
    yearQuota,
    usedToDate,
    planned,
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

/** One scale for every bar in the list, so rows in different groups compare. */
export type DaysLeftScale = { left: number; over: number };

export function daysLeftScale(rows: MemberRemaining[]): DaysLeftScale {
  return {
    left: Math.max(1, ...rows.map((row) => row.carriedOverLeft + row.yearLeft)),
    over: Math.max(0, ...rows.map((row) => -row.overdraft)),
  };
}

export type UsagePart = { part: "used" | "planned" | "pending"; days: number };

export function usageParts(row: MemberRemaining): UsagePart[] {
  const parts: UsagePart[] = [
    { part: "used", days: row.usedToDate },
    { part: "planned", days: row.planned },
    { part: "pending", days: row.pending },
  ];
  return parts.filter((entry) => entry.days !== 0);
}
