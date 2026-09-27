import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { useGroupDetail, type VacationDetail } from "@/lib/query";
import { MAX_ATTACHMENTS_PER_REQUEST, attachmentAccess } from "@/lib/requests/attachments";
import { useAttachmentUploads } from "@/lib/requests/use-attachment-uploads";
import { useViewer } from "@/lib/viewer/use-viewer";

import { AttachmentList } from "./attachment-list";
import { AttachmentUploader } from "./attachment-uploader";

export function AttachmentsHeading({ used }: { used: number }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-baseline justify-between px-1 pb-2">
      <Text className="text-[13px] font-semibold text-muted-foreground">
        {t.requestDetail.attachments}
      </Text>
      <Text testID="attachments-count" className="text-[12.5px] text-faint">
        {t.attachments.slotsUsed(used, MAX_ATTACHMENTS_PER_REQUEST)}
      </Text>
    </View>
  );
}

export function AttachmentSection({
  detail,
  readOnly,
}: {
  detail: VacationDetail;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const viewerId = useViewer()?.id ?? null;
  const group = useGroupDetail(detail.attachments ? detail.groupId : null);
  const access = attachmentAccess(detail, viewerId, group.data?.uploadsAvailable);
  const uploads = useAttachmentUploads({
    requestId: detail.requestId,
    attachments: detail.attachments ?? [],
  });

  const picker = readOnly ? null : access.picker;
  const lapsed = access.lapsed && !readOnly;
  const hasRows = uploads.settled.length > 0 || picker !== null;
  if (!access.shown || (!hasRows && !lapsed)) return null;

  return (
    <View testID="request-attachments">
      <AttachmentsHeading used={MAX_ATTACHMENTS_PER_REQUEST - uploads.remaining} />
      {hasRows ? (
        <View className="overflow-hidden rounded-[24px] bg-card">
          <AttachmentList
            attachments={uploads.settled}
            failedIds={uploads.failedIds}
            canDelete={readOnly ? undefined : access.canDelete}
          />
          {picker ? (
            <AttachmentUploader
              uploads={uploads}
              disabled={picker !== "open"}
              leadingDivider={uploads.settled.length > 0}
            />
          ) : null}
        </View>
      ) : null}
      {picker ? (
        <Text className="px-4 pt-2 text-[12.5px] leading-[18px] text-faint">
          {t.attachments.visibilityNotice}
        </Text>
      ) : null}
      {lapsed ? (
        <Text
          testID="attachments-lapsed"
          className="px-4 pt-2 text-[12.5px] leading-[18px] text-faint"
        >
          {t.attachments.paidPlanOnly}
        </Text>
      ) : null}
    </View>
  );
}
