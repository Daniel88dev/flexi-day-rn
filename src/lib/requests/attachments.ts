import type { Attachment, VacationDetail } from "@/lib/query/vacation-detail";

/** An upload still unchecked after this long never got its bytes; it reads as failed. */
const STALE_UPLOAD_MS = 10 * 60 * 1000;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_REQUEST = 5;

export const ACCEPTED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

const EXTENSION_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  pdf: "application/pdf",
};

function isAcceptedContentType(contentType: string): boolean {
  return (ACCEPTED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

export function isImage(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/**
 * The type to declare for a picked file. A picker can leave HEIC's type blank, so the extension is
 * the fallback; anything else unknown stays as reported and fails the checks.
 */
export function declaredContentType(file: { name: string; type: string }): string {
  if (isAcceptedContentType(file.type)) return file.type;
  const dot = file.name.lastIndexOf(".");
  const extension = dot < 0 ? "" : file.name.slice(dot + 1).toLowerCase();
  return EXTENSION_TYPES[extension] ?? file.type;
}

export type PickProblem = "limit" | "unsupported" | "too-large";

export function pickProblems(
  files: readonly { name: string; type: string; size: number }[],
  openSlots: number
): (PickProblem | null)[] {
  let open = openSlots;
  return files.map((file) => {
    if (open <= 0) return "limit";
    if (!isAcceptedContentType(declaredContentType(file))) return "unsupported";
    if (file.size > MAX_ATTACHMENT_BYTES) return "too-large";
    open -= 1;
    return null;
  });
}

export type AttachmentDisplayStatus = "processing" | "ready" | "rejected" | "failed";

export function attachmentDisplayStatus(
  attachment: Pick<Attachment, "status" | "createdAt">,
  now: number
): AttachmentDisplayStatus {
  if (attachment.status === "READY") return "ready";
  if (attachment.status === "REJECTED") return "rejected";
  return now - Date.parse(attachment.createdAt) > STALE_UPLOAD_MS ? "failed" : "processing";
}

export function formatFileSize(bytes: number, locale: string): string {
  const format = (value: number, unit: string, digits: number) =>
    `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${unit}`;
  if (bytes < 1024) return format(bytes, "B", 0);
  if (bytes < 1024 * 1024) return format(bytes / 1024, "kB", 0);
  return format(bytes / (1024 * 1024), "MB", 1);
}

export function shownAttachments(attachments: readonly Attachment[] | undefined): Attachment[] {
  return (attachments ?? []).filter((attachment) => attachment.deletedAt === null);
}

/** Checked and checking files both hold one of the five slots; rejected and deleted ones do not. */
export function attachmentSlotsUsed(attachments: readonly Attachment[]): number {
  return attachments.filter(
    (attachment) =>
      attachment.deletedAt === null &&
      (attachment.status === "UPLOADING" || attachment.status === "READY")
  ).length;
}

// Rows this session registered whose bytes never arrived. The server keeps them UPLOADING until its
// sweep, so the poll must not wait on them, and a reopened screen still shows them as failed.
const failedUploads = new Set<string>();

export function rememberFailedUpload(attachmentId: string): void {
  failedUploads.add(attachmentId);
}

/** Only a row still `UPLOADING` reads so: a lost transfer may still have landed, and then the server wins. */
export function isFailedUpload(
  attachment: Pick<Attachment, "id" | "status">,
  failedIds: readonly string[] = []
): boolean {
  return (
    attachment.status === "UPLOADING" &&
    (failedIds.includes(attachment.id) || failedUploads.has(attachment.id))
  );
}

export function hasProcessingAttachment(
  attachments: readonly Attachment[] | undefined,
  failedIds: readonly string[],
  now: number
): boolean {
  return (attachments ?? []).some(
    (attachment) =>
      attachment.deletedAt === null &&
      !isFailedUpload(attachment, failedIds) &&
      attachmentDisplayStatus(attachment, now) === "processing"
  );
}

export const PROCESSING_POLL_MS = 3000;

export function processingPollInterval(
  attachments: readonly Attachment[] | undefined,
  failedIds: readonly string[],
  now: number
): number | false {
  return hasProcessingAttachment(attachments, failedIds, now) ? PROCESSING_POLL_MS : false;
}

export type AttachmentAccess = {
  shown: boolean;
  picker: "open" | "full" | null;
  lapsed: boolean;
  canDelete: (attachment: Attachment) => boolean;
};

// `canAttach` already folds in standing, plan, the cap and retention. The owner rule is repeated
// only to tell a lapsed plan from no standing; `uploadsAvailable` is undefined while it loads.
export function attachmentAccess(
  detail: Pick<
    VacationDetail,
    | "userId"
    | "deletedAt"
    | "rejectedAt"
    | "canEdit"
    | "attachments"
    | "canAttach"
    | "canDeleteAnyAttachment"
  >,
  viewerId: string | null,
  uploadsAvailable: boolean | undefined
): AttachmentAccess {
  const adminDeletes = detail.canDeleteAnyAttachment ?? detail.canEdit;
  const canDelete = (attachment: Attachment) =>
    (viewerId !== null && attachment.uploadedByUserId === viewerId) || adminDeletes;

  if (!detail.attachments) return { shown: false, picker: null, lapsed: false, canDelete };

  const live = shownAttachments(detail.attachments);
  const requestLive = detail.deletedAt === null && detail.rejectedAt === null;
  const mayUpload = (viewerId === detail.userId && requestLive) || detail.canEdit;
  const uploadsOff = uploadsAvailable === false;
  const picker =
    !mayUpload || uploadsOff
      ? null
      : detail.canAttach === true
        ? "open"
        : attachmentSlotsUsed(live) >= MAX_ATTACHMENTS_PER_REQUEST
          ? "full"
          : null;
  const lapsed = mayUpload && uploadsOff;

  return { shown: live.length > 0 || picker !== null || lapsed, picker, lapsed, canDelete };
}

export type FormUploadsVerdict = "settling" | "clean" | "problems";

export function formUploadsVerdict(
  jobs: { queued: number; inFlight: number; failed: number },
  attachments: readonly Attachment[] | undefined,
  failedIds: readonly string[],
  now: number
): FormUploadsVerdict {
  const live = shownAttachments(attachments);
  if (jobs.queued > 0 || jobs.inFlight > 0 || hasProcessingAttachment(live, failedIds, now)) {
    return "settling";
  }
  const clean =
    jobs.failed === 0 &&
    live.every(
      (attachment) =>
        !isFailedUpload(attachment, failedIds) &&
        attachmentDisplayStatus(attachment, now) === "ready"
    );
  return clean ? "clean" : "problems";
}
