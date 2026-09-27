import { useCallback } from "react";

import type { StoreDatabase } from "./adapter";
import type { StoreChannel } from "./events";
import { MERGED_VACATION_CHANNELS } from "./queries";
import {
  requestListVacations,
  requestScopeGroups,
  storedRequest,
  type ListedVacation,
  type RequestListQuery,
  type RequestScopeGroup,
  type StoredRequest,
} from "./requests";
import { useStoreOverlay } from "./use-pending-changes";
import { useStoreQuery } from "./use-store-query";

const SCOPE_CHANNELS = [
  "groups",
  "groupUsers",
  "syncState",
] as const satisfies readonly StoreChannel[];

const LIST_CHANNELS = [
  ...MERGED_VACATION_CHANNELS,
  "users",
  "groupUsers",
  "groupMirrors",
  "syncState",
] as const satisfies readonly StoreChannel[];

export function useRequestScopeGroups(): RequestScopeGroup[] {
  return useStoreQuery(requestScopeGroups, SCOPE_CHANNELS);
}

export function useRequestListVacations({ month, scope }: RequestListQuery): ListedVacation[] {
  const changes = useStoreOverlay();
  const { year, month: monthNumber } = month;
  const groupId = scope.kind === "group" ? scope.groupId : null;
  const build = useCallback(
    (db: StoreDatabase) =>
      requestListVacations(db, changes, {
        month: { year, month: monthNumber },
        scope: groupId === null ? { kind: "mine" } : { kind: "group", groupId },
      }),
    [changes, year, monthNumber, groupId]
  );
  return useStoreQuery(build, LIST_CHANNELS);
}

export function useStoredRequest(vacationId: string): StoredRequest | null {
  const changes = useStoreOverlay();
  const build = useCallback(
    (db: StoreDatabase) => storedRequest(db, changes, vacationId),
    [changes, vacationId]
  );
  return useStoreQuery(build, LIST_CHANNELS);
}
