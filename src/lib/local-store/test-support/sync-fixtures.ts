import { applyPage } from "../apply";
import type { StoreRuntime } from "../runtime";
import type {
  SyncBankHolidayRow,
  SyncEnvelope,
  SyncGroupMirrorRow,
  SyncGroupRow,
  SyncGroupUserRow,
  SyncOrganizationRow,
  SyncUserRow,
  SyncUserYearQuotaRow,
  SyncVacationRow,
} from "../envelope";

const STAMP = "2026-09-19T12:00:00.000Z";

/** An envelope page, empty everywhere the test does not care about. */
export function syncPage(page: Partial<SyncEnvelope> = {}): SyncEnvelope {
  return {
    cursor: "cursor-1",
    hasMore: false,
    reset: false,
    organizations: [],
    users: [],
    groups: [],
    groupUsers: [],
    groupMirrors: [],
    userYearQuotas: [],
    bankHolidays: [],
    vacations: [],
    ...page,
  };
}

export function organizationRow(row: Partial<SyncOrganizationRow> = {}): SyncOrganizationRow {
  return { id: "org-1", name: "Northwind", ...row };
}

export function userRow(row: Partial<SyncUserRow> = {}): SyncUserRow {
  return { id: "user-1", name: "Ada", image: null, updatedAt: STAMP, ...row };
}

export function groupRow(row: Partial<SyncGroupRow> = {}): SyncGroupRow {
  return {
    id: "group-1",
    organizationId: "org-1",
    groupName: "Engineering",
    defaultVacationDays: 25,
    defaultHomeOfficeDays: 10,
    defaultSickDays: 5,
    workingDays: [1, 2, 3, 4, 5],
    holidayCountry: "CZ",
    managerUserId: "user-1",
    mainApprovalUser: null,
    tempApprovalUser: null,
    deletedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...row,
  };
}

export function groupUserRow(row: Partial<SyncGroupUserRow> = {}): SyncGroupUserRow {
  return {
    id: "group-user-1",
    groupId: "group-1",
    organizationId: "org-1",
    userId: "user-1",
    viewAccess: true,
    adminAccess: false,
    approverAccess: false,
    controlledUser: true,
    deletedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...row,
  };
}

export function groupMirrorRow(row: Partial<SyncGroupMirrorRow> = {}): SyncGroupMirrorRow {
  return {
    id: "mirror-1",
    userId: "user-1",
    sourceGroupId: "group-1",
    targetGroupId: "group-2",
    organizationId: "org-1",
    deletedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...row,
  };
}

export function userYearQuotaRow(row: Partial<SyncUserYearQuotaRow> = {}): SyncUserYearQuotaRow {
  return {
    id: "quota-1",
    userId: "user-1",
    groupId: "group-1",
    organizationId: "org-1",
    relatedYear: "2026",
    vacationDays: 25,
    homeOfficeDays: 10,
    sickDays: 5,
    carriedOverDays: 0,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...row,
  };
}

export function bankHolidayRow(row: Partial<SyncBankHolidayRow> = {}): SyncBankHolidayRow {
  return {
    id: "holiday-1",
    date: "2026-12-24",
    name: "Christmas Eve",
    country: "CZ",
    region: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...row,
  };
}

export function vacationRow(row: Partial<SyncVacationRow> = {}): SyncVacationRow {
  return {
    id: "vacation-1",
    userId: "user-1",
    groupId: "group-1",
    organizationId: "org-1",
    requestId: "request-1",
    requestedDay: "2026-09-21",
    startTime: null,
    endTime: null,
    vacationType: "VACATION",
    halfDay: false,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    note: null,
    createdByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...row,
  };
}

/** A page with one row in every table of the envelope. */
export function fullSyncPage(page: Partial<SyncEnvelope> = {}): SyncEnvelope {
  return syncPage({
    organizations: [organizationRow()],
    users: [userRow()],
    groups: [groupRow()],
    groupUsers: [groupUserRow()],
    groupMirrors: [groupMirrorRow()],
    userYearQuotas: [userYearQuotaRow()],
    bankHolidays: [bankHolidayRow()],
    vacations: [vacationRow()],
    ...page,
  });
}

/** Puts bookings in the store the way a pull would, for a test that writes over them after. */
export function storeVacations(runtime: StoreRuntime, ...rows: SyncVacationRow[]): void {
  runtime.write((transaction) => applyPage(transaction, syncPage({ vacations: rows }), 1));
}
