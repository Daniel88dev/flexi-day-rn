import { uniqueMembers } from "./remaining";
import type { ReportPeriod, ReportScope, ReportScopeMember } from "./types";

/** The overview's filters. Empty lists mean every group and everyone. */
export type OverviewFilters = { period: ReportPeriod; groupIds: string[]; userIds: string[] };

export const DEFAULT_OVERVIEW_FILTERS: OverviewFilters = {
  period: "rolling",
  groupIds: [],
  userIds: [],
};

export type VisiblePerson = { member: ReportScopeMember; groupNames: string[] };

export function pickLabel(
  picked: string[],
  names: ReadonlyMap<string, string>,
  all: string,
  count: (count: number) => string
): string {
  if (picked.length === 0) return all;
  if (picked.length === 1) return names.get(picked[0]) ?? count(1);
  return count(picked.length);
}

/** Every option picked is the same as none picked, so it collapses back to the default. */
export function togglePick(picked: string[], value: string, order: string[]): string[] {
  const next = new Set(picked);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  const ordered = order.filter((option) => next.has(option));
  return ordered.length === order.length ? [] : ordered;
}

const inGroups = (groupIds: string[]) => (member: ReportScopeMember) =>
  groupIds.length === 0 || groupIds.includes(member.groupId);

export function visiblePeople(scope: ReportScope, groupIds: string[]): VisiblePerson[] {
  const rows = scope.members.filter(inGroups(groupIds));
  return uniqueMembers(rows).map((member) => ({
    member,
    groupNames: scope.groups
      .filter((group) => rows.some((row) => row.id === member.id && row.groupId === group.groupId))
      .map((group) => group.groupName),
  }));
}

export function keepVisiblePeople(
  scope: ReportScope,
  groupIds: string[],
  userIds: string[]
): string[] {
  const visible = new Set(scope.members.filter(inGroups(groupIds)).map((member) => member.id));
  return userIds.filter((id) => visible.has(id));
}

/** Narrowing the groups drops picked people outside them, so People never hides everyone. */
export function pickWithGroups(
  scope: ReportScope,
  filters: OverviewFilters,
  groupIds: string[]
): OverviewFilters {
  return { ...filters, groupIds, userIds: keepVisiblePeople(scope, groupIds, filters.userIds) };
}

export function periodChoices(years: number[], today: Date): ReportPeriod[] {
  const listed = years.length > 0 ? [...years].sort((a, b) => b - a) : [today.getFullYear()];
  return ["rolling", ...listed];
}
