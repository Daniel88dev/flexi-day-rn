import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  UploadError,
  uploadToTarget,
  type PickedFile,
  type UploadTarget,
} from "@/lib/requests/attachment-files";
import { declaredContentType } from "@/lib/requests/attachments";

import { qk } from "./keys";
import { apiRequest } from "./runtime";
import type { Attachment } from "./vacation-detail";

export type UploadAttachmentInput = {
  requestId: string;
  file: PickedFile;
  onRegistered?: (attachmentId: string) => void;
  onProgress?: (fraction: number) => void;
};

// The detail is read again either way: a row registered but never sent still holds a slot until
// the server's sweep clears it.
export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, file, onRegistered, onProgress }: UploadAttachmentInput) => {
      const { attachment, upload } = await apiRequest<{
        attachment: Attachment;
        upload: UploadTarget;
      }>("/api/attachments", {
        method: "POST",
        body: {
          requestId,
          fileName: file.name,
          contentType: declaredContentType(file),
          size: file.size,
        },
      });
      onRegistered?.(attachment.id);
      try {
        await uploadToTarget(upload, file, onProgress);
      } catch (error) {
        // Any failure from here on leaves a registered row without bytes; name it.
        const status = error instanceof UploadError ? error.status : 0;
        throw new UploadError(status, "Upload failed", attachment.id);
      }
      return attachment;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.vacationDetails() }),
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiRequest<{ attachment: Attachment }>(
        `/api/attachments/${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" }
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.vacationDetails() }),
  });
}

export type AttachmentView = { kind: "image" | "document"; url: string; fileName: string };

export async function fetchAttachmentView(attachment: Attachment): Promise<AttachmentView> {
  const { url } = await apiRequest<{ url: string }>(
    `/api/attachments/${encodeURIComponent(attachment.id)}/download-url?disposition=inline`
  );
  return {
    kind: attachment.contentType.startsWith("image/") ? "image" : "document",
    url,
    fileName: attachment.fileName,
  };
}
