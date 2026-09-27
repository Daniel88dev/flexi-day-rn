import * as WebBrowser from "expo-web-browser";
import { TrashIcon } from "phosphor-react-native";
import { Fragment, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { toast } from "sonner-native";

import { useTone } from "@/components/ui/icon";
import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import { haptic } from "@/lib/haptics";
import { useNow } from "@/lib/use-now";
import {
  ApiError,
  fetchAttachmentView,
  qk,
  useDeleteAttachment,
  useWriteFailure,
  type Attachment,
} from "@/lib/query";
import {
  attachmentDisplayStatus,
  formatFileSize,
  isFailedUpload,
  type AttachmentDisplayStatus,
} from "@/lib/requests/attachments";

import { AttachmentRow, RowAction } from "./attachment-row";
import { ImageViewer } from "./image-viewer";

function statusNote(
  attachment: Attachment,
  status: AttachmentDisplayStatus,
  labels: Dictionary["attachments"]
): string | null {
  if (status === "processing") return labels.processing;
  if (status === "failed") return labels.failed;
  if (status === "rejected") {
    return attachment.rejectionReason
      ? labels.rejected[attachment.rejectionReason]
      : labels.rejectedPlain;
  }
  return null;
}

type RowJob = { id: string; action: "open" | "delete" };

const NO_IDS: readonly string[] = [];

export function AttachmentList({
  attachments,
  failedIds = NO_IDS,
  canDelete,
}: {
  attachments: readonly Attachment[];
  failedIds?: readonly string[];
  canDelete?: (attachment: Attachment) => boolean;
}) {
  const { t } = useTranslation();
  const labels = t.attachments;
  const faint = useTone("faint");
  const remove = useDeleteAttachment();
  const writeFailure = useWriteFailure();
  const [busy, setBusy] = useState<RowJob | null>(null);
  const [image, setImage] = useState<{ url: string; fileName: string } | null>(null);
  // Ticks, so a file past the ten-minute cutoff turns failed without a read.
  const now = useNow(30_000);

  const open = async (attachment: Attachment) => {
    setBusy({ id: attachment.id, action: "open" });
    try {
      const view = await fetchAttachmentView(attachment);
      if (view.kind === "image") setImage({ url: view.url, fileName: view.fileName });
      else {
        await WebBrowser.openBrowserAsync(view.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      }
    } catch {
      toast.error(labels.openFailed);
    } finally {
      setBusy(null);
    }
  };

  const deleteNow = async (attachment: Attachment) => {
    setBusy({ id: attachment.id, action: "delete" });
    try {
      await remove.mutateAsync(attachment.id);
      haptic("success");
    } catch (error) {
      // Someone else removed it first; the read that follows takes it off the list.
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) return;
      writeFailure(error, {
        queryKeys: [qk.vacationDetails()],
        retry: () => void deleteNow(attachment),
      });
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = (attachment: Attachment) =>
    Alert.alert(labels.deleteTitle(attachment.fileName), labels.deleteBody, [
      { text: labels.keep, style: "cancel" },
      {
        text: labels.deleteConfirm,
        style: "destructive",
        onPress: () => void deleteNow(attachment),
      },
    ]);

  return (
    <>
      {attachments.map((attachment, index) => {
        const status = isFailedUpload(attachment, failedIds)
          ? "failed"
          : attachmentDisplayStatus(attachment, now);
        const ready = status === "ready";
        const rowBusy = busy?.id === attachment.id;
        const note = statusNote(attachment, status, labels);
        const added = new Date(attachment.createdAt).toLocaleDateString(t.common.locale, {
          day: "numeric",
          month: "short",
        });
        return (
          <Fragment key={attachment.id}>
            {index > 0 ? <View className="ml-[64px] h-px bg-border" /> : null}
            <AttachmentRow
              testID="attachment-row"
              contentType={attachment.contentType}
              name={attachment.fileName}
              meta={`${formatFileSize(attachment.size, t.common.locale)} · ${added}`}
              note={note}
              noteTone={status === "processing" ? "faint" : "danger"}
              onPress={ready && !rowBusy ? () => void open(attachment) : undefined}
              pressLabel={labels.open(attachment.fileName)}
              trailing={
                rowBusy ? (
                  <View className="h-10 w-10 items-center justify-center">
                    <ActivityIndicator color={faint} />
                  </View>
                ) : canDelete?.(attachment) ? (
                  <RowAction
                    testID="attachment-delete"
                    label={labels.delete(attachment.fileName)}
                    icon={TrashIcon}
                    onPress={() => confirmDelete(attachment)}
                  />
                ) : null
              }
            />
          </Fragment>
        );
      })}
      <ImageViewer image={image} onClose={() => setImage(null)} />
    </>
  );
}
