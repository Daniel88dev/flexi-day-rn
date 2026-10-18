import type { CalendarGroupEvent } from "@/lib/local-store";

/** What `GET /api/group-events` says the viewer may do with one event, and who made it. */
export type GroupEventRight = {
  canEdit: boolean;
  createdBy: { id: string; name: string } | null;
};

export type GroupEventRights = ReadonlyMap<string, GroupEventRight>;

export type ShownGroupEvent = CalendarGroupEvent & { canEdit: boolean };

/**
 * Lays the server's answer over the Local store's occurrences. An event the answer does not
 * carry, or every event while it has not arrived, stays locked; the store's creator name stands in.
 */
export function withRights(
  events: readonly CalendarGroupEvent[],
  rights: GroupEventRights | undefined
): ShownGroupEvent[] {
  return events.map((event) => {
    const right = rights?.get(event.id);
    if (!right) return { ...event, canEdit: false };
    const creator = right.createdBy && { id: right.createdBy.id, name: right.createdBy.name };
    return { ...event, creator, canEdit: right.canEdit };
  });
}
