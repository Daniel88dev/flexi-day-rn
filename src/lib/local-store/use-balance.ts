import { useCallback } from "react";

import type { StoreDatabase } from "./adapter";
import { balanceBuckets, type BalanceBucket } from "./balance";
import type { StoreChannel } from "./events";
import { MERGED_VACATION_CHANNELS } from "./queries";
import { useStoreOverlay } from "./use-pending-changes";
import { useStoreQuery } from "./use-store-query";

const BALANCE_CHANNELS = [
  ...MERGED_VACATION_CHANNELS,
  "groupUsers",
  "userYearQuotas",
  "syncState",
] as const satisfies readonly StoreChannel[];

export function useBalanceBuckets(year: number): BalanceBucket[] {
  const changes = useStoreOverlay();
  const build = useCallback(
    (db: StoreDatabase) => balanceBuckets(db, changes, year),
    [changes, year]
  );
  return useStoreQuery(build, BALANCE_CHANNELS);
}
