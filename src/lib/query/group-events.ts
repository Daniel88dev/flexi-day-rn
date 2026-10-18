import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type {
  CreateGroupEventInput,
  GroupEventEditRequest,
  GroupEventScope,
} from "@/lib/group-events/draft";
import { pull, type RequestListScope } from "@/lib/local-store";

import { classifyFailure } from "./failure";
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

export const GROUP_EVENTS_PLAN_REQUIRED = "GROUP_EVENTS_PLAN_REQUIRED";

export type GroupEventDeleteRequest = { scope?: GroupEventScope; occurrenceDate?: string };

const eventPath = (id: string) => `/api/group-events/${encodeURIComponent(id)}`;

function scopeQuery(request: GroupEventDeleteRequest): URLSearchParams {
  const query = new URLSearchParams();
  if (request.scope) query.set("scope", request.scope);
  if (request.occurrenceDate) query.set("occurrenceDate", request.occurrenceDate);
  return query;
}

/** How many one-off changes the edit would drop (D8), writing nothing. */
async function groupEventImpact(id: string, request: GroupEventEditRequest): Promise<number> {
  const query = scopeQuery(request);
  query.set("changes", JSON.stringify(request.changes));
  const answer = await apiRequest<{ droppedOneOffs: number }>(
    `${eventPath(id)}/impact?${query.toString()}`
  );
  return answer.droppedOneOffs;
}

/**
 * Creates, edits and deletes group events. The calendar reads the Local store, so each write ends
 * in a pull. A refusal reads the create rights again and pulls, since the screen acted on a stale
 * answer; the caller words the failure, because it knows where the person is looking.
 */
export function useGroupEventWrites() {
  const queryClient = useQueryClient();

  const options = {
    onSuccess: () => void pull("after-write").catch(() => undefined),
    onError: (error: unknown) => {
      if (classifyFailure(error).kind !== "refusal") return;
      void queryClient.invalidateQueries({ queryKey: qk.groupEventGroups() });
      void pull("refresh").catch(() => undefined);
    },
  };

  const create = useMutation({
    mutationFn: (input: CreateGroupEventInput) =>
      apiRequest<unknown>("/api/group-events", { method: "POST", body: input }),
    ...options,
  });
  const update = useMutation({
    mutationFn: ({ id, request }: { id: string; request: GroupEventEditRequest }) =>
      apiRequest<unknown>(eventPath(id), { method: "PATCH", body: request }),
    ...options,
  });
  const remove = useMutation({
    mutationFn: ({ id, request }: { id: string; request: GroupEventDeleteRequest }) => {
      const query = scopeQuery(request).toString();
      return apiRequest<unknown>(`${eventPath(id)}${query ? `?${query}` : ""}`, {
        method: "DELETE",
      });
    },
    ...options,
  });

  const { mutateAsync: createAsync } = create;
  const { mutateAsync: updateAsync } = update;
  const { mutateAsync: removeAsync } = remove;

  return {
    create: useCallback(
      async (input: CreateGroupEventInput) => {
        await createAsync(input);
      },
      [createAsync]
    ),
    update: useCallback(
      async (id: string, request: GroupEventEditRequest) => {
        await updateAsync({ id, request });
      },
      [updateAsync]
    ),
    remove: useCallback(
      async (id: string, request: GroupEventDeleteRequest) => {
        await removeAsync({ id, request });
      },
      [removeAsync]
    ),
    impact: groupEventImpact,
    busy: create.isPending || update.isPending || remove.isPending,
  };
}
