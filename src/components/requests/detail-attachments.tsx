import { FileTextIcon, ImageIcon } from "phosphor-react-native";
import { Fragment, useState } from "react";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { Attachment } from "@/lib/query";
import { attachmentDisplayStatus, formatFileSize } from "@/lib/requests/attachments";

export function DetailAttachments({ attachments }: { attachments: readonly Attachment[] }) {
  const { t } = useTranslation();
  const labels = t.requestDetail;
  // Read on open; the detail is read again on every open and after every write.
  const [now] = useState(() => Date.now());

  const note = (attachment: Attachment) => {
    const status = attachmentDisplayStatus(attachment, now);
    if (status === "processing") return labels.attachmentProcessing;
    if (status === "failed") return labels.attachmentFailed;
    if (status === "rejected") {
      return attachment.rejectionReason
        ? labels.attachmentRejected[attachment.rejectionReason]
        : labels.attachmentRejectedPlain;
    }
    return null;
  };

  return (
    <View testID="request-attachments" className="rounded-[24px] bg-card">
      {attachments.map((attachment, index) => {
        const message = note(attachment);
        const failed = message !== null && message !== labels.attachmentProcessing;
        const added = new Date(attachment.createdAt).toLocaleDateString(t.common.locale, {
          day: "numeric",
          month: "short",
        });
        return (
          <Fragment key={attachment.id}>
            {index > 0 ? <View className="ml-[64px] h-px bg-border" /> : null}
            <View className="flex-row items-start gap-3 px-4 py-3">
              <View className="h-9 w-9 items-center justify-center rounded-[16px] bg-muted">
                <Icon
                  icon={attachment.contentType.startsWith("image/") ? ImageIcon : FileTextIcon}
                  tone="muted"
                  size={18}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                  {attachment.fileName}
                </Text>
                <Text className="text-[12.5px] text-faint">
                  {formatFileSize(attachment.size, t.common.locale)} · {added}
                </Text>
                {message ? (
                  <Text
                    className={cn("mt-0.5 text-[12.5px]", failed ? "text-danger" : "text-faint")}
                  >
                    {message}
                  </Text>
                ) : null}
              </View>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}
