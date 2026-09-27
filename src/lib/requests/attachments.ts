import type { Attachment } from "@/lib/query/vacation-detail";

/** An upload still unchecked after this long never got its bytes; it reads as failed. */
const STALE_UPLOAD_MS = 10 * 60 * 1000;

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
