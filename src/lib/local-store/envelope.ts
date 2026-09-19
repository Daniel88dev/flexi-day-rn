import type { InferInsertModel } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import type {
  bankHolidays,
  groupMirrors,
  groupUsers,
  groups,
  organizations,
  userYearQuotas,
  users,
  vacations,
} from "./schema";

/** The envelope's table keys, in the dependency order the backend sends and a page is applied in. */
export const SYNC_TABLE_NAMES = [
  "organizations",
  "users",
  "groups",
  "groupUsers",
  "groupMirrors",
  "userYearQuotas",
  "bankHolidays",
  "vacations",
] as const;

export type SyncTableName = (typeof SYNC_TABLE_NAMES)[number];

/** A pull carries the row, never the store's own generation stamp. */
type SyncRow<TTable extends SQLiteTable> = Omit<InferInsertModel<TTable>, "generation">;

export type SyncOrganizationRow = SyncRow<typeof organizations>;
export type SyncUserRow = SyncRow<typeof users>;
export type SyncGroupRow = SyncRow<typeof groups>;
export type SyncGroupUserRow = SyncRow<typeof groupUsers>;
export type SyncGroupMirrorRow = SyncRow<typeof groupMirrors>;
export type SyncUserYearQuotaRow = SyncRow<typeof userYearQuotas>;
export type SyncBankHolidayRow = SyncRow<typeof bankHolidays>;
export type SyncVacationRow = SyncRow<typeof vacations>;

/** One page of `GET /api/sync/pull`, mirroring the backend's `SyncEnvelope`. */
export type SyncEnvelope = {
  cursor: string;
  hasMore: boolean;
  reset: boolean;
  organizations: SyncOrganizationRow[];
  users: SyncUserRow[];
  groups: SyncGroupRow[];
  groupUsers: SyncGroupUserRow[];
  groupMirrors: SyncGroupMirrorRow[];
  userYearQuotas: SyncUserYearQuotaRow[];
  bankHolidays: SyncBankHolidayRow[];
  vacations: SyncVacationRow[];
};
