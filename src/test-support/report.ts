import type {
  MemberChange,
  MemberReport,
  MonthlyUsage,
  ReportBooking,
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

/** Erin's year as the owner opens it from Dev Support, with nothing booked unless given. */
export function memberReport(overrides: Partial<MemberReport> = {}): MemberReport {
  return {
    year: 2026,
    member: {
      id: ERIN.id,
      name: ERIN.name,
      initials: ERIN.initials,
      avatarColor: ERIN.avatarColor,
    },
    groups: [SUPPORT],
    quotas: [],
    summary: [summaryRow({ userId: ERIN.id, groupId: SUPPORT.groupId, yearQuota: 20 })],
    monthly: [],
    bookings: [],
    changes: [],
    ...overrides,
  };
}

/** Today for the cross-year fixtures: "Last 12 months" runs from Mar 2025 to Feb 2026. */
export const CROSS_YEAR_TODAY = new Date(2026, 1, 16, 10);

const DESIGN = scopeGroup({ groupId: "g-design", groupName: "Design Guild", access: "self" });
const OLIVIA = scopeMember({
  id: "u-olivia",
  name: "Olivia Owner",
  initials: "OO",
  avatarColor: "hsl(200, 70%, 45%)",
  groupId: "g-design",
});

function usage(overrides: Partial<MonthlyUsage>): MonthlyUsage {
  return {
    userId: "u-alice",
    groupId: "g-team",
    month: 1,
    vacationType: "VACATION",
    used: 0,
    pending: 0,
    ...overrides,
  };
}

/**
 * A viewer who administers Dev Support without being in it, manages Dev Team, and is a plain
 * member of Design Guild, with both years in scope.
 */
export const crossScope: ReportScope = {
  groups: [SUPPORT, TEAM, DESIGN],
  members: [FRANK, ERIN, ALICE, BOB, OLIVIA],
  years: [2025, 2026],
};

/** In the rolling window: Mar to Dec. January sits outside it. */
export const crossOverview2025: ReportOverview = {
  year: 2025,
  groups: [SUPPORT, TEAM, DESIGN],
  members: [FRANK, ERIN, ALICE, BOB, OLIVIA],
  monthly: [
    usage({ userId: "u-alice", month: 1, used: 2 }),
    usage({ userId: "u-frank", groupId: "g-support", month: 3, used: 2 }),
    usage({ userId: "u-bob", month: 6, used: 5 }),
    usage({ userId: "u-erin", groupId: "g-support", month: 6, used: 3 }),
    usage({ userId: "u-alice", month: 7, used: 4 }),
    usage({ userId: "u-olivia", groupId: "g-design", month: 7, used: 2 }),
    usage({ userId: "u-bob", month: 12, used: 2, pending: 1 }),
    usage({ userId: "u-frank", groupId: "g-support", month: 12, used: 1.5 }),
    usage({ userId: "u-bob", month: 11, vacationType: "SICK_DAY", used: 1 }),
    usage({ userId: "u-alice", month: 9, vacationType: "HOME_OFFICE", used: 6 }),
  ],
  summary: [
    summaryRow({ userId: "u-frank", groupId: "g-support", yearQuota: 28, usedToDate: 25 }),
    summaryRow({ userId: "u-erin", groupId: "g-support", yearQuota: 20, usedToDate: 20 }),
    summaryRow({ userId: "u-alice", yearQuota: 25, usedToDate: 6 }),
    summaryRow({ userId: "u-bob", yearQuota: 22, usedToDate: 8, pending: 1 }),
    summaryRow({ userId: "u-olivia", groupId: "g-design", yearQuota: 25, usedToDate: 2 }),
    summaryRow({ userId: "u-alice", vacationType: "SICK_DAY", yearQuota: 5 }),
    summaryRow({ userId: "u-bob", vacationType: "SICK_DAY", yearQuota: 5, usedToDate: 1 }),
    summaryRow({ userId: "u-alice", vacationType: "HOME_OFFICE", yearQuota: 50, usedToDate: 6 }),
  ],
};

/**
 * In the rolling window: Jan and Feb. Frank brings 3 days over, Bob is overdrawn by 1.5, and
 * Frank's April booking is a plan outside the window.
 */
export const crossOverview2026: ReportOverview = {
  year: 2026,
  groups: [SUPPORT, TEAM, DESIGN],
  members: [FRANK, ERIN, ALICE, BOB, OLIVIA],
  monthly: [
    usage({ userId: "u-alice", month: 1, used: 3 }),
    usage({ userId: "u-erin", groupId: "g-support", month: 1, used: 1 }),
    usage({ userId: "u-bob", month: 2, used: 1.5, pending: 0.5 }),
    usage({ userId: "u-frank", groupId: "g-support", month: 4, used: 5 }),
    usage({ userId: "u-alice", month: 2, vacationType: "SICK_DAY", used: 1 }),
  ],
  summary: [
    summaryRow({
      userId: "u-frank",
      groupId: "g-support",
      carriedOverDays: 3,
      yearQuota: 28,
      plannedRemaining: 5,
    }),
    summaryRow({
      userId: "u-erin",
      groupId: "g-support",
      yearQuota: 20,
      usedToDate: 1,
      pending: 2,
    }),
    summaryRow({ userId: "u-alice", yearQuota: 25, usedToDate: 3 }),
    summaryRow({
      userId: "u-bob",
      yearQuota: 22,
      usedToDate: 1.5,
      plannedRemaining: 22,
      pending: 0.5,
    }),
    summaryRow({ userId: "u-olivia", groupId: "g-design", yearQuota: 25 }),
    summaryRow({ userId: "u-alice", vacationType: "SICK_DAY", yearQuota: 5, usedToDate: 1 }),
    summaryRow({ userId: "u-bob", vacationType: "SICK_DAY", yearQuota: 5 }),
    summaryRow({ userId: "u-alice", vacationType: "HOME_OFFICE", yearQuota: 50 }),
  ],
};

export function crossOverview(year: number): ReportOverview {
  if (year === 2025) return crossOverview2025;
  if (year === 2026) return crossOverview2026;
  return { ...crossOverview2026, year, monthly: [], summary: [] };
}

/**
 * The backend's narrowing of an overview by `groupIds` and `userIds`: every scope group stays,
 * and only the picked people's members, months and summary lines remain.
 */
export function narrowOverview(
  overview: ReportOverview,
  { groupIds, userIds }: { groupIds?: string[]; userIds?: string[] }
): ReportOverview {
  const kept = (row: { groupId: string }, userId: string) =>
    (!groupIds?.length || groupIds.includes(row.groupId)) &&
    (!userIds?.length || userIds.includes(userId));
  return {
    ...overview,
    members: overview.members.filter((member) => kept(member, member.id)),
    monthly: overview.monthly.filter((row) => kept(row, row.userId)),
    summary: overview.summary.filter((row) => kept(row, row.userId)),
  };
}

function booking(overrides: Partial<ReportBooking>): ReportBooking {
  return {
    userId: "u-bob",
    userName: "Bob Dvorak",
    groupId: "g-team",
    groupName: "Dev Team",
    vacationType: "VACATION",
    from: "2026-02-02",
    to: "2026-02-02",
    days: 1,
    year: 2026,
    month: 2,
    status: "approved",
    note: null,
    ...overrides,
  };
}

function change(overrides: Partial<MemberChange>): MemberChange {
  return {
    id: "c-1",
    groupId: "g-team",
    changeType: "USER_YEAR_QUOTAS",
    changeDetail: "Vacation days changed from 20 to 22",
    actor: null,
    actorDeleted: false,
    createdAt: "2026-01-12T09:30:00.000Z",
    ...overrides,
  };
}

const OWNER_ACTOR = { id: "u-owner", name: "Olivia Owner", initials: "OO", avatarColor: "#2a78d6" };

/** Bookings in every status; changes by a person, by a deleted account and by the rollover. */
export const crossMember2026: MemberReport = {
  year: 2026,
  member: { id: BOB.id, name: BOB.name, initials: BOB.initials, avatarColor: BOB.avatarColor },
  groups: [TEAM],
  quotas: [
    {
      userId: "u-bob",
      groupId: "g-team",
      vacationDays: 22,
      homeOfficeDays: 0,
      sickDays: 5,
      carriedOverDays: 0,
    },
  ],
  summary: crossOverview2026.summary.filter((row) => row.userId === "u-bob"),
  monthly: crossOverview2026.monthly.filter((row) => row.userId === "u-bob"),
  bookings: [
    booking({ from: "2026-02-02", to: "2026-02-03", days: 1.5, note: "Ski trip" }),
    booking({ from: "2026-02-20", to: "2026-02-20", days: 0.5, status: "pending" }),
    booking({
      from: "2026-01-19",
      to: "2026-01-23",
      days: 5,
      month: 1,
      status: "rejected",
      note: "Release week",
    }),
    booking({ from: "2026-07-01", to: "2026-07-30", days: 22, month: 7, note: "Summer" }),
  ],
  changes: [
    change({ id: "c-person", actor: OWNER_ACTOR, createdAt: "2026-01-12T09:30:00.000Z" }),
    change({
      id: "c-deleted",
      actorDeleted: true,
      changeDetail: "Carried over days changed from 2 to 0",
      createdAt: "2026-01-05T08:00:00.000Z",
    }),
    change({
      id: "c-rollover",
      changeDetail: "2026 quotas created from 2025",
      createdAt: "2026-01-01T00:05:00.000Z",
    }),
  ],
};

export const crossMember2025: MemberReport = {
  ...crossMember2026,
  year: 2025,
  summary: crossOverview2025.summary.filter((row) => row.userId === "u-bob"),
  monthly: crossOverview2025.monthly.filter((row) => row.userId === "u-bob"),
  bookings: [
    booking({ from: "2025-06-09", to: "2025-06-13", days: 5, year: 2025, month: 6 }),
    booking({ from: "2025-12-22", to: "2025-12-23", days: 2, year: 2025, month: 12 }),
    booking({
      from: "2025-12-29",
      to: "2025-12-29",
      days: 1,
      year: 2025,
      month: 12,
      status: "pending",
    }),
  ],
  changes: [],
};
