import type { CalendarRecordType } from "@/lib/local-store";

// Copied from the web's `flexi-day/lib/api/report-types.ts`.

/** `all` is every member of the group; `self` is a plain member's own rows only. */
export type ReportAccess = "all" | "self";

export type ReportScopeGroup = {
  groupId: string;
  groupName: string;
  access: ReportAccess;
  /** The phone never reads it: quota editing stays on the web (ADR 0003). */
  canEditQuotas: boolean;
};

export type ReportUser = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
};

export type ReportScopeMember = ReportUser & { groupId: string };

export type ReportScope = {
  groups: ReportScopeGroup[];
  members: ReportScopeMember[];
  years: number[];
};

export type MonthlyUsage = {
  userId: string;
  groupId: string;
  /** 1-12. */
  month: number;
  vacationType: CalendarRecordType;
  used: number;
  pending: number;
};

export type ReportSummaryRow = {
  userId: string;
  groupId: string;
  vacationType: CalendarRecordType;
  carriedOverDays: number;
  yearQuota: number;
  usedToDate: number;
  plannedRemaining: number;
  pending: number;
  remaining: number;
};

export type ReportOverview = {
  year: number;
  groups: ReportScopeGroup[];
  members: ReportScopeMember[];
  monthly: MonthlyUsage[];
  summary: ReportSummaryRow[];
};

export type ReportBooking = {
  userId: string;
  userName: string;
  groupId: string;
  groupName: string;
  vacationType: CalendarRecordType;
  from: string;
  to: string;
  days: number;
  year: number;
  month: number;
  status: "approved" | "pending" | "rejected";
  note: string | null;
};

export type MemberChange = {
  id: string;
  groupId: string;
  changeType: string;
  changeDetail: string;
  /** Null for the year rollover, and for an admin who has since deleted their account. */
  actor: ReportUser | null;
  actorDeleted?: boolean;
  createdAt: string;
};

export type ReportQuotaRow = {
  userId: string;
  groupId: string;
  vacationDays: number;
  homeOfficeDays: number;
  sickDays?: number;
  carriedOverDays: number;
};

export type MemberReport = {
  year: number;
  member: ReportUser;
  groups: ReportScopeGroup[];
  quotas: ReportQuotaRow[];
  summary: ReportSummaryRow[];
  monthly: MonthlyUsage[];
  bookings: ReportBooking[];
  changes: MemberChange[];
};

/** The web's filters without `types`: the phone picks one allowance from the full answer. */
export type ReportFilters = {
  year: number;
  groupIds?: string[];
  userIds?: string[];
};

export type ReportPeriod = "rolling" | number;
