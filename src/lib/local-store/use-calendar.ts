import { useCallback } from "react";

import type { StoreDatabase } from "./adapter";
import {
  calendarBankHolidays,
  calendarVacations,
  type CalendarBankHoliday,
  type CalendarQuery,
} from "./calendar";
import type { StoreChannel } from "./events";
import { MERGED_VACATION_CHANNELS } from "./queries";
import type { ListedVacation } from "./requests";
import { useStoreOverlay } from "./use-pending-changes";
import { useStoreQuery } from "./use-store-query";

const VACATION_CHANNELS = [
  ...MERGED_VACATION_CHANNELS,
  "users",
  "groupUsers",
  "groupMirrors",
  "syncState",
] as const satisfies readonly StoreChannel[];

const HOLIDAY_CHANNELS = [
  "bankHolidays",
  "groups",
  "groupUsers",
  "syncState",
] as const satisfies readonly StoreChannel[];

export function useCalendarVacations({ range, scope }: CalendarQuery): ListedVacation[] {
  const changes = useStoreOverlay();
  const { from, until } = range;
  const groupId = scope.kind === "group" ? scope.groupId : null;
  const build = useCallback(
    (db: StoreDatabase) =>
      calendarVacations(db, changes, {
        range: { from, until },
        scope: groupId === null ? { kind: "mine" } : { kind: "group", groupId },
      }),
    [changes, from, until, groupId]
  );
  return useStoreQuery(build, VACATION_CHANNELS);
}

export function useCalendarBankHolidays({ range, scope }: CalendarQuery): CalendarBankHoliday[] {
  const { from, until } = range;
  const groupId = scope.kind === "group" ? scope.groupId : null;
  const build = useCallback(
    (db: StoreDatabase) =>
      calendarBankHolidays(db, {
        range: { from, until },
        scope: groupId === null ? { kind: "mine" } : { kind: "group", groupId },
      }),
    [from, until, groupId]
  );
  return useStoreQuery(build, HOLIDAY_CHANNELS);
}
