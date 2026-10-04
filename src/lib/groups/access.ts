import type { Dictionary } from "@/i18n/en";
import type { GroupRole } from "@/lib/local-store";
import type { GroupAccess } from "@/lib/query";

export type StandingBadge = GroupRole | "orgAdmin";

type Standing = Pick<GroupAccess, "viaOrgAdmin" | "isMember">;

export const administeredBadge = (viaOrgAdmin: boolean): StandingBadge =>
  viaOrgAdmin ? "orgAdmin" : "manager";

/**
 * For a group the store does not hold. A viewer who is neither a member nor an org admin can only
 * have reached it as its manager; the backend refuses everyone else.
 */
export function serverBadge(access: Standing): StandingBadge | null {
  if (access.isMember && !access.viaOrgAdmin) return null;
  return administeredBadge(access.viaOrgAdmin);
}

export const showsOrgAdminNotice = (access: Standing) => access.viaOrgAdmin && !access.isMember;

export const badgeLabel = (t: Dictionary, badge: StandingBadge) =>
  badge === "orgAdmin" ? t.groups.orgAdmin : t.groups.roles[badge];
