import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type {
  CreateGroupEventInput,
  GroupEventEditRequest,
  GroupEventScope,
} from "@/lib/group-events/draft";
import type { GroupEventRight, GroupEventRights } from "@/lib/group-events/rights";
import { pull, type RequestListScope } from "@/lib/local-store";
import type { YearMonth } from "@/lib/requests/months";

import { classifyFailure } from "./failure";
import { qk } from "./keys";
import { apiRequest } from "./runtime";

/** One row of `GET /api/group-events/groups`: `canCreate` covers both rights and plan. */
export type GroupEventGroup = { groupId: string; groupName: string; canCreate: boolean };

export function useGroupEventGroups() {
  return useQuery({
    queryKey: qk.groupEventGroups(),
    queryFn: ({ signal }) => apiRequest<GroupEventGroup[]>("/api/group-events/groups", { signal }),
  });
}

type GroupEventRow = { id: string } & GroupEventRight;

function rightsOf(rows: GroupEventRow[]): GroupEventRights {
  return new Map(
    rows.map((row) => [
      row.id,
      {
        canEdit: row.canEdit,
        createdBy: row.createdBy && { id: row.createdBy.id, name: row.createdBy.name },
      },
    ])
  );
}

/**
 * Who may change each of a month's group events, from `GET /api/group-events`. The calendar draws
 * the events from the Local store; this read only decides Edit and Delete. No month, no read.
 */
export function useGroupEventRights(
  month: YearMonth | null,
  scope: RequestListScope
): GroupEventRights | undefined {
  const groupId = scope.kind === "group" ? scope.groupId : null;
  const query = useQuery({
    queryKey: qk.groupEvents(month?.year ?? 0, month?.month ?? 0, groupId),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        year: String(month?.year),
        month: String(month?.month),
      });
      if (groupId) params.set("groupId", groupId);
      return apiRequest<GroupEventRow[]>(`/api/group-events?${params.toString()}`, { signal });
    },
    select: rightsOf,
    enabled: month !== null,
  });
  return query.data;
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

/** How many one-off changes the edit would drop, writing nothing. */
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
 * in a pull, and the rights are read again. A refusal does the same, since the screen acted on a
 * stale answer; the caller words the failure, because it knows where the person is looking.
 */
export function useGroupEventWrites() {
  const queryClient = useQueryClient();
  const readAgain = () => void queryClient.invalidateQueries({ queryKey: qk.allGroupEvents() });

  const options = {
    onSuccess: () => {
      readAgain();
      void pull("after-write").catch(() => undefined);
    },
    onError: (error: unknown) => {
      if (classifyFailure(error).kind !== "refusal") return;
      readAgain();
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
