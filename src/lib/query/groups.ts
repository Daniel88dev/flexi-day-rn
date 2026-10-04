import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { alreadyMemberGroup, type ClosedInvite, type JoinInput } from "@/lib/groups/invites";
import { pull } from "@/lib/local-store";

import { qk } from "./keys";
import { apiRequest } from "./runtime";
import type { UserSummary } from "./vacation-detail";

export type HolidayCountry = { code: string; name: string };

export type GroupAccess = {
  canView: boolean;
  canAdmin: boolean;
  viaOrgAdmin: boolean;
  isMember: boolean;
};

export type GroupOrganization = {
  name: string;
  /** Absent means the benefit is not offered. */
  sickDayBenefitActive?: boolean;
};

export type GroupDetail = {
  id: string;
  organization: GroupOrganization | null;
  groupName: string;
  defaultVacationDays: number;
  defaultHomeOfficeDays: number;
  defaultSickDays?: number;
  /** `Date.getDay()` numbers, Sunday 0. */
  workingDays: number[];
  holidayCountry: string | null;
  managerUserId: string;
  access: GroupAccess;
  uploadsAvailable?: boolean;
};

/** A `GET /api/group/administered` item, trimmed to what the phone shows. */
export type AdministeredGroup = {
  id: string;
  groupName: string;
  organization: GroupOrganization | null;
  memberCount: number;
  /** False when the viewer is the group's manager rather than an admin of its organization. */
  viaOrgAdmin: boolean;
};

export type GroupMember = {
  id: string;
  groupId: string;
  userId: string;
  viewAccess: boolean;
  adminAccess: boolean;
  approverAccess: boolean;
  controlledUser: boolean;
  deletedAt: string | null;
  email: string;
  user: UserSummary;
};

export type UserYearQuota = {
  id: string;
  userId: string;
  groupId: string;
  relatedYear: string;
  vacationDays: number;
  homeOfficeDays: number;
  sickDays?: number;
  carriedOverDays: number;
};

export function useHolidayCountries({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.bankHolidayCountries(),
    queryFn: ({ signal }) =>
      apiRequest<HolidayCountry[]>("/api/bank-holidays/countries", { signal }),
    // The dataset ships with the backend, so it never changes while the app runs.
    staleTime: Infinity,
    enabled,
  });
}

/** The groups the viewer administers without being a member; the backend alone decides which (ADR 0003). */
export function useAdministeredGroups() {
  return useQuery({
    queryKey: qk.administeredGroups(),
    queryFn: ({ signal }) => apiRequest<AdministeredGroup[]>("/api/group/administered", { signal }),
  });
}

const groupDetailQuery = (groupId: string) => ({
  queryKey: qk.group(groupId),
  queryFn: ({ signal }: { signal?: AbortSignal }) =>
    apiRequest<GroupDetail>(`/api/group/${encodeURIComponent(groupId)}`, { signal }),
});

export function useGroupDetail(groupId: string | null) {
  return useQuery({ ...groupDetailQuery(groupId ?? ""), enabled: groupId !== null });
}

/** Asked of the server, never the store: an org admin's own membership holds no member rows. */
export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: qk.groupUsers(groupId ?? ""),
    queryFn: ({ signal }) =>
      apiRequest<GroupMember[]>(`/api/group-user/${encodeURIComponent(groupId ?? "")}`, {
        signal,
      }),
    enabled: groupId !== null,
  });
}

export function useQuotas(groupId: string | null, year: number) {
  return useQuery({
    queryKey: qk.quotas(groupId ?? "", year),
    queryFn: ({ signal }) =>
      apiRequest<UserYearQuota[]>(`/api/quotas/${encodeURIComponent(groupId ?? "")}?year=${year}`, {
        signal,
      }),
    enabled: groupId !== null,
  });
}

/** `POST /api/auth/invite/preview`: what an invite link's holder sees before joining. */
export type InvitePreview = {
  groupId: string;
  groupName: string;
  inviterName: string | null;
  /** Null only on invites older than email invites, which anyone with the link may use. */
  invitedEmail: string | null;
  status: "open" | ClosedInvite;
  expiresAt: string;
};

/**
 * Never retried, and dropped from the cache once the join screen lets go of it, so the secret
 * leaves memory with the screen. Reading it uses nothing up.
 */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: qk.invitePreview(token),
    queryFn: ({ signal }) =>
      apiRequest<InvitePreview>("/api/auth/invite/preview", {
        method: "POST",
        body: { token },
        signal,
      }),
    retry: false,
    gcTime: 0,
    networkMode: "always",
  });
}

export type JoinedGroup = {
  groupId: string;
  /** Null when the name read failed; the detail then reads it again. */
  groupName: string | null;
  alreadyMember: boolean;
};

function sendJoin(input: JoinInput) {
  return input.kind === "link"
    ? apiRequest<{ groupId: string }>("/api/auth/invite/join", {
        method: "POST",
        body: { token: input.token },
      })
    : apiRequest<{ groupId: string }>(`/api/group-user/code/${encodeURIComponent(input.code)}`, {
        method: "POST",
      });
}

async function groupNameOf(queryClient: QueryClient, groupId: string): Promise<string | null> {
  try {
    return (await queryClient.fetchQuery({ ...groupDetailQuery(groupId), retry: false })).groupName;
  } catch {
    return null;
  }
}

/**
 * Joining is a sync reset trigger, so the after-write pull brings the group in as a snapshot
 * before the mutation settles. A pull that fails still counts as joined: the group arrives on a
 * later pull, and the detail takes its header from the server until then. A 409
 * `ALREADY_MEMBER` resolves to its group instead of failing.
 */
export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: JoinInput): Promise<JoinedGroup> => {
      let groupId: string;
      try {
        ({ groupId } = await sendJoin(input));
      } catch (failure) {
        const memberOf = alreadyMemberGroup(failure);
        if (!memberOf) throw failure;
        const groupName = await groupNameOf(queryClient, memberOf);
        return { groupId: memberOf, groupName, alreadyMember: true };
      }
      await pull("after-write").catch(() => undefined);
      return { groupId, groupName: await groupNameOf(queryClient, groupId), alreadyMember: false };
    },
    onSuccess: ({ groupId, alreadyMember }) => {
      if (alreadyMember) return;
      for (const queryKey of [
        qk.administeredGroups(),
        qk.group(groupId),
        qk.groupUsers(groupId),
        qk.dashboardSummary(),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
