import { useQuery } from "@tanstack/react-query";

import type { RequestListScope } from "@/lib/local-store";

import { qk } from "./keys";
import { apiRequest } from "./runtime";

/** One row of `GET /api/group-events/groups`: `canCreate` is S2's rights and S3's plan together. */
export type GroupEventGroup = { groupId: string; groupName: string; canCreate: boolean };

/** Plan state for the create entries: a server read, never the Local store (spec 6.6). */
export function useGroupEventGroups() {
  return useQuery({
    queryKey: qk.groupEventGroups(),
    queryFn: ({ signal }) => apiRequest<GroupEventGroup[]>("/api/group-events/groups", { signal }),
  });
}

/**
 * Whether a create entry shows: in Group scope that group's own answer, in Mine scope while any
 * group may create. Nothing shows before the read answers.
 */
export function canCreateGroupEvent(
  groups: readonly GroupEventGroup[] | undefined,
  scope: RequestListScope
): boolean {
  if (!groups) return false;
  return scope.kind === "group"
    ? groups.some((group) => group.groupId === scope.groupId && group.canCreate)
    : groups.some((group) => group.canCreate);
}
