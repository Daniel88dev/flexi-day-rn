import type { VacationDetail } from "@/lib/query/vacation-detail";

const EVA = { id: "user-2", name: "Eva Horáková", initials: "EH", avatarColor: "hsl(20 60% 50%)" };

/** A pending one-day request of Eva's, as `GET /api/vacation/:id` answers it. */
export function vacationDetail(patch: Partial<VacationDetail> = {}): VacationDetail {
  return {
    id: "vacation-1",
    userId: EVA.id,
    groupId: "group-1",
    groupName: "Engineering",
    requestId: "request-1",
    requestedDay: "2026-09-21",
    rangeStart: "2026-09-21",
    rangeEnd: "2026-09-21",
    vacationIds: ["vacation-1"],
    vacationType: "VACATION",
    startTime: null,
    endTime: null,
    halfDay: false,
    note: null,
    approvedAt: null,
    rejectedAt: null,
    deletedAt: null,
    createdByUserId: EVA.id,
    updatedAt: "2026-09-10T08:00:00.000Z",
    user: EVA,
    approvedByUser: null,
    rejectedByUser: null,
    createdByUser: EVA,
    deletedByUser: null,
    canApprove: false,
    canCancel: false,
    canEdit: false,
    history: [
      {
        id: "event-1",
        eventType: "CREATED",
        actor: EVA,
        reason: null,
        createdAt: "2026-09-10T08:00:00.000Z",
      },
    ],
    ...patch,
  };
}
