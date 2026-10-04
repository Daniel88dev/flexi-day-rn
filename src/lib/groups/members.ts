import type { GroupMember, UserYearQuota } from "@/lib/query";

export type MemberRole = "manager" | "admin" | "approver";

export function orderedMembers(
  members: readonly GroupMember[],
  managerUserId: string
): GroupMember[] {
  return members
    .filter((member) => member.deletedAt === null)
    .sort((a, b) => {
      const managerFirst = Number(b.userId === managerUserId) - Number(a.userId === managerUserId);
      return managerFirst || a.user.name.localeCompare(b.user.name);
    });
}

export function memberBadges(
  member: GroupMember,
  managerUserId: string
): { roles: MemberRole[]; tracked: boolean } {
  const roles: MemberRole[] = [];
  if (member.userId === managerUserId) roles.push("manager");
  if (member.adminAccess) roles.push("admin");
  if (member.approverAccess) roles.push("approver");
  return { roles, tracked: member.controlledUser };
}

export type QuotaDefaults = { vacationDays: number; homeOfficeDays: number; sickDays: number };

export type QuotaFigure = {
  key: "vacation" | "homeOffice" | "sickDays" | "carriedOver";
  value: string;
};

/** A member without a quota row this year has the group's defaults and nothing carried over. */
export function quotaFigures(
  quota: UserYearQuota | undefined,
  defaults: QuotaDefaults,
  sickDayBenefit: boolean
): QuotaFigure[] {
  const carried = quota?.carriedOverDays ?? 0;
  return [
    { key: "vacation", value: String(quota?.vacationDays ?? defaults.vacationDays) },
    { key: "homeOffice", value: String(quota?.homeOfficeDays ?? defaults.homeOfficeDays) },
    ...(sickDayBenefit
      ? [{ key: "sickDays" as const, value: String(quota?.sickDays ?? defaults.sickDays) }]
      : []),
    { key: "carriedOver", value: carried > 0 ? `+${carried}` : "0" },
  ];
}
