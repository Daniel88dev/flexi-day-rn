import type { StoreChannel } from "./events";
import { groupStanding, type GroupStanding } from "./standing";
import { useStoreQuery } from "./use-store-query";

const STANDING_CHANNELS = [
  "groups",
  "groupUsers",
  "syncState",
] as const satisfies readonly StoreChannel[];

export function useGroupStanding(): GroupStanding {
  return useStoreQuery(groupStanding, STANDING_CHANNELS);
}
