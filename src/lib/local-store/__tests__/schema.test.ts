import { getTableColumns, type Table } from "drizzle-orm";

import type { StoreConnection } from "../adapter";
import { STORE_DDL } from "../ddl.generated";
import { createBetterSqlite3Adapter } from "../test-support/better-sqlite3-adapter";
import {
  CALENDAR_RECORD_TYPES,
  type CalendarRecordType,
  bankHolidays,
  groupMirrors,
  groupUsers,
  groups,
  organizations,
  userYearQuotas,
  users,
  vacations,
} from "../schema";

/**
 * Transcribed from the backend's `src/services/sync/types.ts`: the sync pull's rows, with `?`
 * for a nullable column. A drift here is the store no longer mirroring what a pull returns.
 */
const SYNC_ROWS: Record<string, [Table, Record<string, string>]> = {
  organizations: [organizations, { id: "text", name: "text" }],
  users: [users, { id: "text", name: "text", image: "text?", updatedAt: "text" }],
  groups: [
    groups,
    {
      id: "text",
      organizationId: "text",
      groupName: "text",
      defaultVacationDays: "integer",
      defaultHomeOfficeDays: "integer",
      defaultSickDays: "integer",
      workingDays: "json",
      holidayCountry: "text?",
      managerUserId: "text",
      mainApprovalUser: "text?",
      tempApprovalUser: "text?",
      deletedAt: "text?",
      createdAt: "text",
      updatedAt: "text",
    },
  ],
  groupUsers: [
    groupUsers,
    {
      id: "text",
      groupId: "text",
      organizationId: "text",
      userId: "text",
      viewAccess: "boolean",
      adminAccess: "boolean",
      approverAccess: "boolean",
      controlledUser: "boolean",
      deletedAt: "text?",
      createdAt: "text",
      updatedAt: "text",
    },
  ],
  groupMirrors: [
    groupMirrors,
    {
      id: "text",
      userId: "text",
      sourceGroupId: "text",
      targetGroupId: "text",
      organizationId: "text",
      deletedAt: "text?",
      createdAt: "text",
      updatedAt: "text",
    },
  ],
  userYearQuotas: [
    userYearQuotas,
    {
      id: "text",
      userId: "text",
      groupId: "text",
      organizationId: "text",
      relatedYear: "text",
      vacationDays: "integer",
      homeOfficeDays: "integer",
      sickDays: "integer",
      carriedOverDays: "integer",
      createdAt: "text",
      updatedAt: "text",
    },
  ],
  bankHolidays: [
    bankHolidays,
    {
      id: "text",
      date: "text",
      name: "text",
      country: "text",
      region: "text?",
      createdAt: "text",
      updatedAt: "text",
    },
  ],
  vacations: [
    vacations,
    {
      id: "text",
      userId: "text",
      groupId: "text",
      organizationId: "text",
      requestId: "text",
      requestedDay: "text",
      startTime: "text?",
      endTime: "text?",
      vacationType: "text",
      halfDay: "boolean",
      approvedAt: "text?",
      approvedBy: "text?",
      rejectedAt: "text?",
      rejectedBy: "text?",
      rejectionReason: "text?",
      note: "text?",
      createdByUserId: "text?",
      deletedAt: "text?",
      deletedByUserId: "text?",
      createdAt: "text",
      updatedAt: "text",
    },
  ],
};

const STORED_TYPES: Record<string, string> = {
  string: "text",
  number: "integer",
  boolean: "boolean",
  json: "json",
};

function storedColumns(table: Table): Record<string, string> {
  return Object.fromEntries(
    Object.values(getTableColumns(table)).map((column) => [
      column.name,
      `${STORED_TYPES[column.dataType]}${column.notNull ? "" : "?"}`,
    ])
  );
}

function openInMemory(): StoreConnection {
  const connection = createBetterSqlite3Adapter(":memory:").open();
  for (const statement of STORE_DDL) connection.execute(statement);
  return connection;
}

function vacationRow(id: string, vacationType: CalendarRecordType) {
  return {
    id,
    userId: "user-1",
    groupId: "group-1",
    organizationId: "org-1",
    requestId: "request-1",
    requestedDay: "2026-09-21",
    vacationType,
    halfDay: false,
    createdAt: "2026-09-19T12:00:00.000Z",
    updatedAt: "2026-09-19T12:00:00.000Z",
  };
}

describe("schema", () => {
  it.each(Object.keys(SYNC_ROWS))("mirrors the sync pull's %s row", (name) => {
    const [table, row] = SYNC_ROWS[name];

    expect(storedColumns(table)).toEqual({ ...row, generation: "integer" });
  });

  it("types a vacation with exactly the nine calendar record types", () => {
    expect(vacations.vacationType.enumValues).toEqual(CALENDAR_RECORD_TYPES);
    expect(CALENDAR_RECORD_TYPES).toEqual([
      "VACATION",
      "HOME_OFFICE",
      "SICK",
      "SICK_DAY",
      "PAID_TIME_OFF",
      "NON_PAID_LEAVE",
      "STUDY_LEAVE",
      "BANK_HOLIDAY",
      "OTHER",
    ]);
  });

  it("stores every calendar record type and refuses anything else", () => {
    const connection = openInMemory();
    try {
      for (const [index, type] of CALENDAR_RECORD_TYPES.entries()) {
        connection.db
          .insert(vacations)
          .values(vacationRow(`ok-${index}`, type))
          .run();
      }
      expect(connection.db.select().from(vacations).all()).toHaveLength(
        CALENDAR_RECORD_TYPES.length
      );

      expect(() =>
        connection.db
          .insert(vacations)
          .values(vacationRow("bad", "HOLIDAY" as CalendarRecordType))
          .run()
      ).toThrow(/vacations_vacationType_chk/);
    } finally {
      connection.close();
    }
  });

  it("indexes the reads the app makes and the organization on every partitioned table", () => {
    const indexes = STORE_DDL.flatMap(
      (statement) => statement.match(/CREATE INDEX `([^`]+)`/)?.slice(1) ?? []
    );

    expect(indexes.sort()).toEqual(
      [
        "bankHolidays_country_date_idx",
        "groupMirrors_organizationId_idx",
        "groupUsers_groupId_idx",
        "groupUsers_organizationId_idx",
        "groups_organizationId_idx",
        "userYearQuotas_organizationId_idx",
        "userYearQuotas_userId_groupId_relatedYear_idx",
        "vacations_groupId_requestedDay_idx",
        "vacations_organizationId_idx",
        "vacations_requestId_idx",
        "vacations_userId_requestedDay_idx",
      ].sort()
    );
  });
});
