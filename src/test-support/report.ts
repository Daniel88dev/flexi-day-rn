import type {
  ReportOverview,
  ReportScope,
  ReportScopeGroup,
  ReportScopeMember,
  ReportSummaryRow,
} from "@/lib/report";

export function scopeGroup(overrides: Partial<ReportScopeGroup> = {}): ReportScopeGroup {
  return {
    groupId: "g-team",
    groupName: "Dev Team",
    access: "all",
    canEditQuotas: false,
    ...overrides,
  };
}

export function scopeMember(overrides: Partial<ReportScopeMember> = {}): ReportScopeMember {
  return {
    id: "u-alice",
    name: "Alice Novak",
    initials: "AN",
    avatarColor: "hsl(280, 60%, 50%)",
    groupId: "g-team",
    ...overrides,
  };
}

export function summaryRow(overrides: Partial<ReportSummaryRow> = {}): ReportSummaryRow {
  return {
    userId: "u-alice",
    groupId: "g-team",
    vacationType: "VACATION",
    carriedOverDays: 0,
    yearQuota: 25,
    usedToDate: 0,
    plannedRemaining: 0,
    pending: 0,
    remaining: 25,
    ...overrides,
  };
}

export function reportScope(overrides: Partial<ReportScope> = {}): ReportScope {
  return {
    groups: [scopeGroup()],
    members: [scopeMember()],
    years: [2026],
    ...overrides,
  };
}

export function reportOverview(overrides: Partial<ReportOverview> = {}): ReportOverview {
  return {
    year: 2026,
    groups: [scopeGroup()],
    members: [scopeMember()],
    monthly: [],
    summary: [summaryRow()],
    ...overrides,
  };
}

const SUPPORT = scopeGroup({ groupId: "g-support", groupName: "Dev Support", canEditQuotas: true });
const TEAM = scopeGroup({ groupId: "g-team", groupName: "Dev Team", canEditQuotas: true });

const FRANK = scopeMember({
  id: "u-frank",
  name: "Frank Benes",
  initials: "FB",
  avatarColor: "hsl(95, 65%, 45%)",
  groupId: "g-support",
});
const ERIN = scopeMember({
  id: "u-erin",
  name: "Erin Kral",
  initials: "EK",
  avatarColor: "hsl(120, 65%, 42%)",
  groupId: "g-support",
});
const ALICE = scopeMember({
  id: "u-alice",
  name: "Alice Novak",
  initials: "AN",
  avatarColor: "hsl(280, 60%, 50%)",
  groupId: "g-team",
});
const BOB = scopeMember({
  id: "u-bob",
  name: "Bob Dvorak",
  initials: "BD",
  avatarColor: "hsl(350, 70%, 50%)",
  groupId: "g-team",
});

/**
 * The owner's view after `dev:scenario`, trimmed: Dev Support administered without membership and
 * Dev Team, both `all` with `canEditQuotas`, carry-over on Frank, an overdraft on Bob, and Home
 * office lines in Dev Team only.
 */
export const ownerScope: ReportScope = {
  groups: [SUPPORT, TEAM],
  members: [FRANK, ERIN, ALICE, BOB],
  years: [2026],
};

export const ownerOverview: ReportOverview = {
  year: 2026,
  groups: [SUPPORT, TEAM],
  members: [FRANK, ERIN, ALICE, BOB],
  monthly: [],
  summary: [
    summaryRow({
      userId: "u-frank",
      groupId: "g-support",
      carriedOverDays: 3,
      yearQuota: 28,
      usedToDate: 3.5,
    }),
    summaryRow({
      userId: "u-erin",
      groupId: "g-support",
      yearQuota: 20,
      usedToDate: 13,
      pending: 3,
    }),
    summaryRow({
      userId: "u-alice",
      groupId: "g-team",
      yearQuota: 28,
      usedToDate: 10,
      plannedRemaining: 3,
      pending: 2,
    }),
    summaryRow({ userId: "u-bob", groupId: "g-team", yearQuota: 22, usedToDate: 23.5, pending: 1 }),
    summaryRow({
      userId: "u-alice",
      groupId: "g-team",
      vacationType: "HOME_OFFICE",
      yearQuota: 50,
      usedToDate: 6,
    }),
    summaryRow({
      userId: "u-bob",
      groupId: "g-team",
      vacationType: "HOME_OFFICE",
      yearQuota: 50,
      usedToDate: 12,
    }),
  ],
};
