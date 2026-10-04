import type { StoreChannel } from "./events";
import { myGroupsWithRole, type MyGroup } from "./my-groups";
import { useStoreQuery } from "./use-store-query";

const MY_GROUPS_CHANNELS = [
  "groups",
  "groupUsers",
  "organizations",
  "syncState",
] as const satisfies readonly StoreChannel[];

export function useMyGroups(): MyGroup[] {
  return useStoreQuery(myGroupsWithRole, MY_GROUPS_CHANNELS);
}
