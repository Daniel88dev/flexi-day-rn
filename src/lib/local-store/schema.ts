import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** The backend's nine calendar record types, the values `vacations.vacationType` holds. */
export const CALENDAR_RECORD_TYPES = [
  "VACATION",
  "HOME_OFFICE",
  "SICK",
  "SICK_DAY",
  "PAID_TIME_OFF",
  "NON_PAID_LEAVE",
  "STUDY_LEAVE",
  "BANK_HOLIDAY",
  "OTHER",
] as const;

export type CalendarRecordType = (typeof CALENDAR_RECORD_TYPES)[number];

const CALENDAR_RECORD_TYPE_LIST = CALENDAR_RECORD_TYPES.map((type) => `'${type}'`).join(", ");

/** Stamped on every row a pull writes, so the sweep after a snapshot can drop what it did not re-send. */
const generation = () => integer("generation").notNull().default(0);

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  generation: generation(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  image: text("image"),
  updatedAt: text("updatedAt").notNull(),
  generation: generation(),
});

export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    groupName: text("groupName").notNull(),
    defaultVacationDays: integer("defaultVacationDays").notNull(),
    defaultHomeOfficeDays: integer("defaultHomeOfficeDays").notNull(),
    defaultSickDays: integer("defaultSickDays").notNull(),
    workingDays: text("workingDays", { mode: "json" }).$type<number[]>().notNull(),
    holidayCountry: text("holidayCountry"),
    managerUserId: text("managerUserId").notNull(),
    mainApprovalUser: text("mainApprovalUser"),
    tempApprovalUser: text("tempApprovalUser"),
    deletedAt: text("deletedAt"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    generation: generation(),
  },
  (table) => [index("groups_organizationId_idx").on(table.organizationId)]
);

export const groupUsers = sqliteTable(
  "groupUsers",
  {
    id: text("id").primaryKey(),
    groupId: text("groupId").notNull(),
    organizationId: text("organizationId").notNull(),
    userId: text("userId").notNull(),
    viewAccess: integer("viewAccess", { mode: "boolean" }).notNull(),
    adminAccess: integer("adminAccess", { mode: "boolean" }).notNull(),
    approverAccess: integer("approverAccess", { mode: "boolean" }).notNull(),
    controlledUser: integer("controlledUser", { mode: "boolean" }).notNull(),
    deletedAt: text("deletedAt"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    generation: generation(),
  },
  (table) => [
    index("groupUsers_groupId_idx").on(table.groupId),
    index("groupUsers_organizationId_idx").on(table.organizationId),
  ]
);

export const groupMirrors = sqliteTable(
  "groupMirrors",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    sourceGroupId: text("sourceGroupId").notNull(),
    targetGroupId: text("targetGroupId").notNull(),
    organizationId: text("organizationId").notNull(),
    deletedAt: text("deletedAt"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    generation: generation(),
  },
  (table) => [index("groupMirrors_organizationId_idx").on(table.organizationId)]
);

export const userYearQuotas = sqliteTable(
  "userYearQuotas",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    groupId: text("groupId").notNull(),
    organizationId: text("organizationId").notNull(),
    relatedYear: text("relatedYear").notNull(),
    vacationDays: integer("vacationDays").notNull(),
    homeOfficeDays: integer("homeOfficeDays").notNull(),
    sickDays: integer("sickDays").notNull(),
    carriedOverDays: integer("carriedOverDays").notNull(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    generation: generation(),
  },
  (table) => [
    index("userYearQuotas_userId_groupId_relatedYear_idx").on(
      table.userId,
      table.groupId,
      table.relatedYear
    ),
    index("userYearQuotas_organizationId_idx").on(table.organizationId),
  ]
);

export const bankHolidays = sqliteTable(
  "bankHolidays",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    region: text("region"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    generation: generation(),
  },
  (table) => [index("bankHolidays_country_date_idx").on(table.country, table.date)]
);

export const vacations = sqliteTable(
  "vacations",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    groupId: text("groupId").notNull(),
    organizationId: text("organizationId").notNull(),
    requestId: text("requestId").notNull(),
    requestedDay: text("requestedDay").notNull(),
    startTime: text("startTime"),
    endTime: text("endTime"),
    vacationType: text("vacationType", { enum: CALENDAR_RECORD_TYPES }).notNull(),
    halfDay: integer("halfDay", { mode: "boolean" }).notNull(),
    approvedAt: text("approvedAt"),
    approvedBy: text("approvedBy"),
    rejectedAt: text("rejectedAt"),
    rejectedBy: text("rejectedBy"),
    rejectionReason: text("rejectionReason"),
    note: text("note"),
    createdByUserId: text("createdByUserId"),
    deletedAt: text("deletedAt"),
    deletedByUserId: text("deletedByUserId"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    generation: generation(),
  },
  (table) => [
    index("vacations_groupId_requestedDay_idx").on(table.groupId, table.requestedDay),
    index("vacations_userId_requestedDay_idx").on(table.userId, table.requestedDay),
    index("vacations_requestId_idx").on(table.requestId),
    index("vacations_organizationId_idx").on(table.organizationId),
    check(
      "vacations_vacationType_chk",
      sql`${table.vacationType} in (${sql.raw(CALENDAR_RECORD_TYPE_LIST)})`
    ),
  ]
);

/** Store-internal, never part of a pull: the one row that says whose store this is and where it stopped. */
export const syncState = sqliteTable(
  "syncState",
  {
    id: integer("id").primaryKey(),
    userId: text("userId").notNull(),
    cursor: text("cursor"),
    lastPulledAt: text("lastPulledAt"),
    generation: integer("generation").notNull().default(0),
  },
  (table) => [check("syncState_single_row_chk", sql`${table.id} = 1`)]
);

export const schema = {
  organizations,
  users,
  groups,
  groupUsers,
  groupMirrors,
  userYearQuotas,
  bankHolidays,
  vacations,
  syncState,
};
