import { useQuery } from "@tanstack/react-query";

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

export function useGroupDetail(groupId: string | null) {
  return useQuery({
    queryKey: qk.group(groupId ?? ""),
    queryFn: ({ signal }) =>
      apiRequest<GroupDetail>(`/api/group/${encodeURIComponent(groupId ?? "")}`, { signal }),
    enabled: groupId !== null,
  });
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
