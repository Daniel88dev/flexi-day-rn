import type {
  Attachment,
  UserSummary,
  VacationDetail,
  VacationEventKind,
} from "@/lib/query/vacation-detail";

export type TimelineKind = VacationEventKind | "ATTACHMENT_ADDED" | "ATTACHMENT_REMOVED";

/**
 * Who did something. `gone` is an account since removed; `unnamed` is someone the detail carries
 * no summary for, which only an admin acting from outside the request's cast can be.
 */
export type TimelineActor =
  { kind: "named"; user: UserSummary } | { kind: "gone" } | { kind: "unnamed" };

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  actor: TimelineActor;
  reason: string | null;
  fileName: string | null;
  createdAt: string;
};

function namedPeople(detail: VacationDetail): UserSummary[] {
  const seen = new Map<string, UserSummary>();
  for (const person of [
    detail.user,
    detail.createdByUser,
    detail.approvedByUser,
    detail.rejectedByUser,
    detail.deletedByUser,
    ...detail.history.map((event) => event.actor),
  ]) {
    if (person && !seen.has(person.id)) seen.set(person.id, person);
  }
  return [...seen.values()];
}

function resolveActor(people: readonly UserSummary[], userId: string | null): TimelineActor {
  if (userId === null) return { kind: "gone" };
  const user = people.find((person) => person.id === userId);
  return user ? { kind: "named", user } : { kind: "unnamed" };
}

function fileEntry(
  attachment: Attachment,
  people: readonly UserSummary[],
  kind: "ATTACHMENT_ADDED" | "ATTACHMENT_REMOVED",
  by: string | null,
  at: string
): TimelineEntry {
  return {
    id: `${kind}-${attachment.id}`,
    kind,
    actor: resolveActor(people, by),
    reason: null,
    fileName: attachment.fileName,
    createdAt: at,
  };
}

/** A file that never passed the checks was never attached, so it gets no entry. */
export function mergeTimeline(detail: VacationDetail): TimelineEntry[] {
  const people = namedPeople(detail);
  const entries: TimelineEntry[] = detail.history.map((event) => ({
    id: event.id,
    kind: event.eventType,
    actor: event.actor ? { kind: "named", user: event.actor } : { kind: "gone" },
    reason: event.reason,
    fileName: null,
    createdAt: event.createdAt,
  }));
  for (const attachment of detail.attachments ?? []) {
    if (attachment.status === "READY") {
      entries.push(
        fileEntry(
          attachment,
          people,
          "ATTACHMENT_ADDED",
          attachment.uploadedByUserId,
          attachment.createdAt
        )
      );
    }
    if (attachment.deletedAt) {
      entries.push(
        fileEntry(
          attachment,
          people,
          "ATTACHMENT_REMOVED",
          attachment.deletedByUserId,
          attachment.deletedAt
        )
      );
    }
  }
  return entries.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}
