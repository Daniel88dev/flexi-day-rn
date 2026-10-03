// PROTOTYPE (T-143, prototype/report): the report endpoints' shapes, copied from
// flexi-day/lib/api/report-types.ts.
import type { CalendarRecordType } from "@/lib/local-store";

export type ReportAccess = "all" | "self";

export type ReportScopeGroup = {
  groupId: string;
  groupName: string;
  access: ReportAccess;
  canEditQuotas: boolean;
};

export type UserSummary = { id: string; name: string; initials: string; avatarColor: string };

export type ReportScopeMember = UserSummary & { groupId: string };

export type ReportScope = {
  groups: ReportScopeGroup[];
  members: ReportScopeMember[];
  years: number[];
};

export type MonthlyUsage = {
  userId: string;
  groupId: string;
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
  actor: UserSummary | null;
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
  member: UserSummary;
  groups: ReportScopeGroup[];
  quotas: ReportQuotaRow[];
  summary: ReportSummaryRow[];
  monthly: MonthlyUsage[];
  bookings: ReportBooking[];
  changes: MemberChange[];
};

export type ReportPeriod = "rolling" | number;

export type ReportFilters = {
  groupIds: string[];
  userIds: string[];
  types: CalendarRecordType[];
};
