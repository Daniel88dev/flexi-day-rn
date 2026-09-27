import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { CalendarRecordType } from "@/lib/local-store";
import { processingPollInterval } from "@/lib/requests/attachments";

import { qk } from "./keys";
import { apiRequest } from "./runtime";
import { useWriteFailure } from "./use-write-failure";

export type UserSummary = { id: string; name: string; initials: string; avatarColor: string };

export type VacationEventKind =
  "CREATED" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMMENT" | "UPDATED";

export type VacationEvent = {
  id: string;
  eventType: VacationEventKind;
  /** Null when the actor's account has since been removed. */
  actor: UserSummary | null;
  reason: string | null;
  createdAt: string;
};

export type AttachmentStatus = "UPLOADING" | "READY" | "REJECTED";

export type AttachmentRejectionReason =
  "TYPE_MISMATCH" | "IMAGE_UNREADABLE" | "PDF_JAVASCRIPT" | "PDF_LAUNCH_ACTION" | "PDF_ENCRYPTED";

export type Attachment = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  status: AttachmentStatus;
  rejectionReason: AttachmentRejectionReason | null;
  uploadedByUserId: string | null;
  createdAt: string;
  deletedAt: string | null;
  deletedByUserId: string | null;
};

export type VacationDetail = {
  id: string;
  userId: string;
  groupId: string;
  groupName: string;
  requestId: string;
  requestedDay: string;
  rangeStart: string;
  rangeEnd: string;
  vacationIds: string[];
  vacationType: CalendarRecordType;
  startTime: string | null;
  endTime: string | null;
  halfDay: boolean;
  note: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  deletedAt: string | null;
  createdByUserId: string | null;
  updatedAt: string;
  user: UserSummary;
  approvedByUser: UserSummary | null;
  rejectedByUser: UserSummary | null;
  createdByUser: UserSummary | null;
  deletedByUser: UserSummary | null;
  canApprove: boolean;
  canCancel: boolean;
  canEdit: boolean;
  history: VacationEvent[];
  /** Absent, not empty, for a viewer who may see the day but not its files. */
  attachments?: Attachment[];
  /** Standing, plan, the five-file cap and retention together, as the backend reckons them. */
  canAttach?: boolean;
  canDeleteAnyAttachment?: boolean;
};

/** A row of `GET /api/group-user/:groupId`, as much of it as booking on behalf reads. */
export type GroupMember = {
  userId: string;
  controlledUser: boolean;
  deletedAt: string | null;
  user: UserSummary;
};

export type GroupDetail = {
  id: string;
  organization: { sickDayBenefitActive?: boolean } | null;
  access?: { canAdmin: boolean };
  uploadsAvailable?: boolean;
};

const vacationPath = (vacationId: string) => `/api/vacation/${encodeURIComponent(vacationId)}`;

/**
 * Fresh on every open: nothing is kept once the screen lets go, so the permissions a screen shows
 * are never an earlier screen's answer. `null` reads nothing.
 */
export function useVacationDetail(
  vacationId: string | null,
  { poll = true }: { poll?: boolean } = {}
) {
  return useQuery({
    queryKey: qk.vacation(vacationId ?? ""),
    queryFn: ({ signal }) => apiRequest<VacationDetail>(vacationPath(vacationId ?? ""), { signal }),
    enabled: vacationId !== null,
    staleTime: 0,
    gcTime: 0,
    // The first narrow exception to T-28's no-polling: while a file on the open screen is still
    // being checked, read the Request every 3 s. It stops once every file settles, when a read
    // fails, while another screen covers this one (`poll`), and with the screen itself.
    refetchInterval: (query) =>
      poll && query.state.status !== "error"
        ? processingPollInterval(query.state.data?.attachments, [], Date.now())
        : false,
  });
}

export function useGroupDetail(groupId: string | null) {
  return useQuery({
    queryKey: qk.group(groupId ?? ""),
    queryFn: ({ signal }) =>
      apiRequest<GroupDetail>(`/api/group/${encodeURIComponent(groupId ?? "")}`, { signal }),
    enabled: groupId !== null,
  });
}

export async function rereadAfterVacationWrite(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.vacationDetails() }),
    queryClient.invalidateQueries({ queryKey: qk.myApprovals() }),
    queryClient.invalidateQueries({ queryKey: qk.dashboardSummary() }),
  ]);
}

export function useCommentVacation(vacationId: string) {
  const queryClient = useQueryClient();
  const writeFailure = useWriteFailure();

  const mutation = useMutation({
    mutationFn: (message: string) =>
      apiRequest<{ message: string }>(`/api/vacation/comment/${encodeURIComponent(vacationId)}`, {
        method: "POST",
        body: { message },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.vacation(vacationId) }),
    onError: (error, message) =>
      writeFailure(error, {
        queryKeys: [qk.vacation(vacationId)],
        retry: () => mutation.mutate(message),
      }),
  });

  return mutation;
}
