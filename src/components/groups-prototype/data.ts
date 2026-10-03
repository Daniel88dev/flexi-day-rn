// PROTOTYPE (T-144, prototype/groups): throwaway reads and the one write for the Groups design.
// It reaches into the local store's schema directly; the real build adds a store query instead.
import { useMutation, useQuery } from "@tanstack/react-query";
import { and, eq, isNull } from "drizzle-orm";
import { useCallback } from "react";

import { pull, useStoreQuery, type StoreDatabase } from "@/lib/local-store";
import { groups, groupUsers, organizations } from "@/lib/local-store/schema";
import { ApiError, apiRequest } from "@/lib/query";

export type Role = "manager" | "admin" | "approver" | null;

export type StoreGroup = {
  id: string;
  groupName: string;
  organizationName: string | null;
  defaultVacationDays: number;
  defaultHomeOfficeDays: number;
  workingDays: number[];
  holidayCountry: string | null;
  role: Role;
};

const STORE_CHANNELS = ["groups", "groupUsers", "organizations"] as const;

export function useStoreGroups(viewerId: string | null): StoreGroup[] {
  const build = useCallback(
    (db: StoreDatabase): StoreGroup[] => {
      if (!viewerId) return [];
      const rows = db
        .select({
          id: groups.id,
          groupName: groups.groupName,
          organizationName: organizations.name,
          defaultVacationDays: groups.defaultVacationDays,
          defaultHomeOfficeDays: groups.defaultHomeOfficeDays,
          workingDays: groups.workingDays,
          holidayCountry: groups.holidayCountry,
          managerUserId: groups.managerUserId,
          adminAccess: groupUsers.adminAccess,
          approverAccess: groupUsers.approverAccess,
        })
        .from(groups)
        .innerJoin(
          groupUsers,
          and(
            eq(groupUsers.groupId, groups.id),
            eq(groupUsers.userId, viewerId),
            isNull(groupUsers.deletedAt)
          )
        )
        .leftJoin(organizations, eq(organizations.id, groups.organizationId))
        .where(isNull(groups.deletedAt))
        .all();
      return rows
        .map(({ managerUserId, adminAccess, approverAccess, ...row }) => ({
          ...row,
          role: (managerUserId === viewerId
            ? "manager"
            : adminAccess
              ? "admin"
              : approverAccess
                ? "approver"
                : null) as Role,
        }))
        .sort((a, b) => a.groupName.localeCompare(b.groupName));
    },
    [viewerId]
  );
  return useStoreQuery(build, STORE_CHANNELS);
}

export type ServerGroup = {
  id: string;
  groupName: string;
  defaultVacationDays: number;
  defaultHomeOfficeDays: number;
  defaultSickDays: number;
  workingDays: number[];
  holidayCountry: string | null;
  managerUserId: string;
  organization: { id: string; name: string; sickDayBenefitActive?: boolean } | null;
  memberCount?: number;
  viaOrgAdmin?: boolean;
  access?: { canView: boolean; canAdmin: boolean; viaOrgAdmin: boolean; isMember: boolean };
};

export type Member = {
  id: string;
  userId: string;
  viewAccess: boolean;
  adminAccess: boolean;
  approverAccess: boolean;
  controlledUser: boolean;
  email: string;
  user: { id: string; name: string };
};

export type Quota = {
  userId: string;
  vacationDays: number;
  homeOfficeDays: number;
  sickDays: number;
  carriedOverDays: number;
};

export function useAdministeredGroups() {
  return useQuery({
    queryKey: ["prototype", "group-administered"],
    queryFn: ({ signal }) => apiRequest<ServerGroup[]>("/api/group/administered", { signal }),
  });
}

export function useServerGroup(groupId: string) {
  return useQuery({
    queryKey: ["prototype", "group", groupId],
    queryFn: ({ signal }) => apiRequest<ServerGroup>(`/api/group/${groupId}`, { signal }),
  });
}

export function useMembers(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["prototype", "group-users", groupId],
    queryFn: ({ signal }) => apiRequest<Member[]>(`/api/group-user/${groupId}`, { signal }),
    enabled,
  });
}

export function useQuotas(groupId: string, year: number, enabled: boolean) {
  return useQuery({
    queryKey: ["prototype", "quotas", groupId, year],
    queryFn: ({ signal }) => apiRequest<Quota[]>(`/api/quotas/${groupId}?year=${year}`, { signal }),
    enabled,
  });
}

export type InvitePreview = {
  groupId: string;
  groupName: string;
  inviterName: string | null;
  invitedEmail: string | null;
  status: "open" | "used" | "expired" | "revoked";
  expiresAt: string;
};

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: ["prototype", "invite-preview", token],
    queryFn: ({ signal }) =>
      apiRequest<InvitePreview>("/api/auth/invite/preview", {
        method: "POST",
        body: { token },
        signal,
      }),
    retry: false,
  });
}

export type InviteInput =
  { kind: "link"; token: string } | { kind: "broken-link" } | { kind: "code"; code: string };

// Ported from flexi-day/lib/invites/parse-invite-input.ts.
export function parseInviteInput(raw: string): InviteInput | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL | null = null;
  if (value.includes("/")) {
    try {
      url = new URL(value.includes("://") ? value : `https://${value}`);
    } catch {
      url = null;
    }
  }
  if (!url || !/\/join\/?$/.test(url.pathname)) return { kind: "code", code: value };
  const token = url.searchParams.get("token")?.trim();
  return token ? { kind: "link", token } : { kind: "broken-link" };
}

const JOIN_COPY: Record<string, string> = {
  INVITE_NOT_FOUND: "That invite doesn't exist. Check the code, or ask for a new invite.",
  INVITE_USED: "This invite has already been used.",
  INVITE_EXPIRED: "This invite has expired. Ask for a new one.",
  INVITE_REVOKED: "This invite was withdrawn. Ask for a new one.",
  INVITE_EMAIL_MISMATCH: "This invite was sent to a different email address.",
  EMAIL_NOT_VERIFIED_USE_INVITE_LINK: "Use the Join button in your invite email.",
  PLAN_LIMIT: "This group is full on its current plan. Ask its manager to upgrade.",
  READ_ONLY: "This group is read-only right now. Ask its manager.",
};

export class AlreadyMember extends Error {
  constructor(readonly groupId: string) {
    super("already a member");
  }
}

export function joinErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = typeof error.context?.code === "string" ? error.context.code : null;
    if (code && JOIN_COPY[code]) return JOIN_COPY[code];
    if (error.status === 404) return JOIN_COPY.INVITE_NOT_FOUND;
    if (error.status === 403) return JOIN_COPY.INVITE_EMAIL_MISMATCH;
    if (error.status === 400)
      return "That doesn't look like an invite code. Codes look like 7KQ2-M9PX-4HRT.";
    return error.serverMessage ?? "Joining didn't work. Try again.";
  }
  return "Can't reach the server. Check your connection and try again.";
}

type Joined = { groupId: string; groupName: string };

export function useJoin() {
  return useMutation({
    mutationFn: async (input: InviteInput): Promise<Joined> => {
      try {
        const row: { groupId: string } =
          input.kind === "link"
            ? await apiRequest<{ groupId: string }>("/api/auth/invite/join", {
                method: "POST",
                body: { token: input.token },
              })
            : await apiRequest<{ groupId: string }>(
                `/api/group-user/code/${encodeURIComponent(input.kind === "code" ? input.code : "")}`,
                { method: "POST" }
              );
        await pull("after-write").catch(() => undefined);
        const group = await apiRequest<ServerGroup>(`/api/group/${row.groupId}`).catch(() => null);
        return { groupId: row.groupId, groupName: group?.groupName ?? "the group" };
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const groupId = error.context?.groupId;
          if (typeof groupId === "string") throw new AlreadyMember(groupId);
        }
        throw error;
      }
    },
  });
}

const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: "M" },
  { day: 2, label: "T" },
  { day: 3, label: "W" },
  { day: 4, label: "T" },
  { day: 5, label: "F" },
  { day: 6, label: "S" },
  { day: 0, label: "S" },
];
export { WEEKDAYS };

const COUNTRY: Record<string, string> = {
  CZ: "Czechia",
  SK: "Slovakia",
  DE: "Germany",
  AT: "Austria",
  PL: "Poland",
  GB: "United Kingdom",
  US: "United States",
};
export const countryName = (code: string | null) => (code ? (COUNTRY[code] ?? code) : null);

export function workingDaysLabel(days: number[]): string {
  const set = new Set(days);
  if ([1, 2, 3, 4, 5].every((d) => set.has(d)) && !set.has(0) && !set.has(6)) return "Mon to Fri";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return WEEKDAYS.filter((w) => set.has(w.day))
    .map((w) => names[w.day])
    .join(", ");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}…@${domain}`;
}

export const ROLE_LABEL: Record<Exclude<Role, null>, string> = {
  manager: "Manager",
  admin: "Admin",
  approver: "Approver",
};
