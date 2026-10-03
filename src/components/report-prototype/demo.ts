// PROTOTYPE (T-143, prototype/report): stub data for `?data=demo`, shaped like the report
// endpoints. The seeded scenario only books September and October, which leaves ten of twelve
// columns empty, so this fills a whole year to judge the charts at a realistic density.
import type { CalendarRecordType } from "@/lib/local-store";

import type {
  MemberChange,
  MemberReport,
  ReportBooking,
  ReportOverview,
  ReportScope,
  ReportScopeGroup,
  ReportScopeMember,
  ReportSummaryRow,
} from "./types";

const TEAM: ReportScopeGroup = {
  groupId: "demo-team",
  groupName: "Dev Team",
  access: "all",
  canEditQuotas: true,
};
const SUPPORT: ReportScopeGroup = {
  groupId: "demo-support",
  groupName: "Dev Support",
  access: "all",
  canEditQuotas: true,
};

const person = (id: string, name: string, hue: number, groupId: string): ReportScopeMember => ({
  id,
  name,
  initials: name
    .split(" ")
    .map((p) => p[0])
    .join(""),
  avatarColor: `hsl(${hue}, 65%, 50%)`,
  groupId,
});

const MEMBERS: ReportScopeMember[] = [
  person("demo-alice", "Alice Novak", 282, TEAM.groupId),
  person("demo-bob", "Bob Dvorak", 346, TEAM.groupId),
  person("demo-carol", "Carol Svoboda", 47, TEAM.groupId),
  person("demo-olivia", "Olivia Owner", 51, TEAM.groupId),
  person("demo-dave", "Dave Horak", 295, SUPPORT.groupId),
  person("demo-erin", "Erin Kral", 111, SUPPORT.groupId),
  person("demo-frank", "Frank Benes", 88, SUPPORT.groupId),
];

type Status = ReportBooking["status"];
type Entry = [CalendarRecordType, string, number, Status, string?];

const BOOKINGS: Record<string, Entry[]> = {
  "demo-alice": [
    ["VACATION", "2025-11-17", 3, "approved"],
    ["VACATION", "2025-12-22", 4, "approved", "Christmas at my parents'"],
    ["HOME_OFFICE", "2026-02-09", 2, "approved"],
    ["VACATION", "2026-04-13", 2, "approved"],
    ["VACATION", "2026-07-06", 8, "approved", "Croatia"],
    ["HOME_OFFICE", "2026-09-14", 3, "approved"],
    ["VACATION", "2026-10-06", 2, "pending"],
    ["VACATION", "2026-12-21", 3, "approved"],
  ],
  "demo-bob": [
    ["VACATION", "2025-12-29", 2, "approved"],
    ["VACATION", "2026-02-16", 5, "approved", "Skiing"],
    ["VACATION", "2026-05-04", 3, "approved"],
    ["VACATION", "2026-06-22", 10, "approved"],
    ["VACATION", "2026-08-24", 5.5, "approved"],
    ["VACATION", "2026-10-12", 1, "pending"],
    ["VACATION", "2026-09-07", 2, "rejected"],
  ],
  "demo-carol": [
    ["VACATION", "2026-01-02", 1, "approved"],
    ["HOME_OFFICE", "2026-03-02", 2, "approved"],
    ["VACATION", "2026-05-25", 4, "approved"],
    ["VACATION", "2026-08-10", 5, "approved", "Summer cottage"],
    ["SICK_DAY", "2026-09-21", 1, "approved"],
    ["VACATION", "2026-10-26", 3, "pending"],
    ["VACATION", "2026-11-16", 2, "approved"],
  ],
  "demo-olivia": [
    ["VACATION", "2026-03-23", 2, "approved"],
    ["VACATION", "2026-07-20", 6, "approved"],
    ["VACATION", "2026-09-28", 0.5, "approved"],
  ],
  "demo-dave": [
    ["VACATION", "2025-11-03", 2, "approved"],
    ["VACATION", "2026-01-12", 3, "approved"],
    ["VACATION", "2026-06-01", 5, "approved"],
    ["VACATION", "2026-08-03", 4, "approved"],
    ["VACATION", "2026-10-19", 2, "pending"],
  ],
  "demo-erin": [
    ["VACATION", "2026-02-23", 2, "approved"],
    ["VACATION", "2026-04-06", 4, "approved"],
    ["VACATION", "2026-07-13", 7, "approved"],
    ["SICK_DAY", "2026-09-09", 1, "approved"],
    ["VACATION", "2026-12-28", 3, "pending"],
  ],
  "demo-frank": [
    ["VACATION", "2025-12-15", 5, "approved"],
    ["VACATION", "2026-05-11", 2, "approved"],
    ["VACATION", "2026-09-01", 1.5, "approved"],
  ],
};

const QUOTA: Record<string, { vacation: number; carry: number }> = {
  "demo-alice": { vacation: 25, carry: 3 },
  "demo-bob": { vacation: 20, carry: 2 },
  "demo-carol": { vacation: 25, carry: 3 },
  "demo-olivia": { vacation: 25, carry: 4 },
  "demo-dave": { vacation: 25, carry: 5 },
  "demo-erin": { vacation: 20, carry: 0 },
  "demo-frank": { vacation: 25, carry: 6 },
};

const HOME_OFFICE_QUOTA = 10;
const SICK_DAY_QUOTA = 3;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + Math.max(0, Math.ceil(days) - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bookingsFor(member: ReportScopeMember, year: number): ReportBooking[] {
  const group = member.groupId === TEAM.groupId ? TEAM : SUPPORT;
  return (BOOKINGS[member.id] ?? [])
    .filter(([, from]) => Number(from.slice(0, 4)) === year)
    .map(([type, from, days, status, note]) => ({
      userId: member.id,
      userName: member.name,
      groupId: group.groupId,
      groupName: group.groupName,
      vacationType: type,
      from,
      to: addDays(from, days),
      days,
      year,
      month: Number(from.slice(5, 7)),
      status,
      note: note ?? null,
    }));
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function summaryFor(member: ReportScopeMember, year: number): ReportSummaryRow[] {
  const bookings = bookingsFor(member, year);
  const today = todayIso();
  const quota = QUOTA[member.id] ?? { vacation: 25, carry: 0 };
  const rows: [CalendarRecordType, number, number][] = [
    ["VACATION", quota.vacation, year === 2026 ? quota.carry : 0],
    ["HOME_OFFICE", HOME_OFFICE_QUOTA, 0],
    ["SICK_DAY", SICK_DAY_QUOTA, 0],
  ];
  return rows.map(([type, yearQuota, carriedOverDays]) => {
    const ofType = bookings.filter((b) => b.vacationType === type);
    const sum = (pick: (b: ReportBooking) => boolean) =>
      ofType.filter(pick).reduce((t, b) => t + b.days, 0);
    const usedToDate = sum((b) => b.status === "approved" && b.from < today);
    const plannedRemaining = sum((b) => b.status === "approved" && b.from >= today);
    const pending = sum((b) => b.status === "pending");
    return {
      userId: member.id,
      groupId: member.groupId,
      vacationType: type,
      carriedOverDays,
      yearQuota,
      usedToDate,
      plannedRemaining,
      pending,
      remaining: yearQuota + carriedOverDays - usedToDate - plannedRemaining,
    };
  });
}

function monthlyFor(member: ReportScopeMember, year: number) {
  const byKey = new Map<string, ReportOverview["monthly"][number]>();
  for (const b of bookingsFor(member, year)) {
    if (b.status === "rejected") continue;
    const key = `${b.month}-${b.vacationType}`;
    const row = byKey.get(key) ?? {
      userId: member.id,
      groupId: member.groupId,
      month: b.month,
      vacationType: b.vacationType,
      used: 0,
      pending: 0,
    };
    if (b.status === "approved") row.used += b.days;
    else row.pending += b.days;
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

export function demoScope(self: boolean): ReportScope {
  if (self) {
    const carol = MEMBERS.find((m) => m.id === "demo-carol")!;
    return {
      groups: [{ ...TEAM, access: "self", canEditQuotas: false }],
      members: [carol],
      years: [2025, 2026],
    };
  }
  return { groups: [SUPPORT, TEAM], members: MEMBERS, years: [2025, 2026] };
}

export function demoOverview(
  year: number,
  filters: { groupIds: string[]; userIds: string[]; types: CalendarRecordType[] },
  self: boolean
): ReportOverview {
  const scope = demoScope(self);
  const members = scope.members.filter(
    (m) =>
      (filters.groupIds.length === 0 || filters.groupIds.includes(m.groupId)) &&
      (filters.userIds.length === 0 || filters.userIds.includes(m.id))
  );
  const typeOk = (type: CalendarRecordType) =>
    filters.types.length === 0 || filters.types.includes(type);
  return {
    year,
    groups: scope.groups,
    members,
    monthly: members.flatMap((m) => monthlyFor(m, year)).filter((r) => typeOk(r.vacationType)),
    summary: members.flatMap((m) => summaryFor(m, year)).filter((r) => typeOk(r.vacationType)),
  };
}

const CHANGES: Record<string, Omit<MemberChange, "id" | "groupId">[]> = {
  default: [
    {
      changeType: "quota",
      changeDetail: "Vacation quota for 2026 set to 25 days",
      actor: {
        id: "demo-olivia",
        name: "Olivia Owner",
        initials: "OO",
        avatarColor: "hsl(51, 65%, 50%)",
      },
      createdAt: "2026-01-05T09:12:00Z",
    },
    {
      changeType: "rollover",
      changeDetail: "3 days carried over from 2025",
      actor: null,
      createdAt: "2026-01-01T00:05:00Z",
    },
    {
      changeType: "access",
      changeDetail: "Joined Dev Team",
      actor: {
        id: "demo-olivia",
        name: "Olivia Owner",
        initials: "OO",
        avatarColor: "hsl(51, 65%, 50%)",
      },
      createdAt: "2025-03-14T13:40:00Z",
    },
    {
      changeType: "quota",
      changeDetail: "Home office quota for 2026 set to 10 days",
      actor: null,
      actorDeleted: true,
      createdAt: "2025-12-18T16:02:00Z",
    },
  ],
};

export function demoMemberReport(userId: string, year: number, self: boolean): MemberReport {
  const member = demoScope(self).members.find((m) => m.id === userId) ?? MEMBERS[0];
  const group = member.groupId === TEAM.groupId ? TEAM : SUPPORT;
  const quota = QUOTA[member.id] ?? { vacation: 25, carry: 0 };
  return {
    year,
    member,
    groups: [self ? { ...group, access: "self", canEditQuotas: false } : group],
    quotas: [
      {
        userId: member.id,
        groupId: group.groupId,
        vacationDays: quota.vacation,
        homeOfficeDays: HOME_OFFICE_QUOTA,
        sickDays: SICK_DAY_QUOTA,
        carriedOverDays: year === 2026 ? quota.carry : 0,
      },
    ],
    summary: summaryFor(member, year),
    monthly: monthlyFor(member, year),
    bookings: bookingsFor(member, year).sort((a, b) => b.from.localeCompare(a.from)),
    changes: (year === 2026 ? CHANGES.default : []).map((c, i) => ({
      ...c,
      id: `demo-change-${i}`,
      groupId: group.groupId,
    })),
  };
}
