import { CheckIcon, WarningCircleIcon } from "phosphor-react-native";
import { ActivityIndicator, View } from "react-native";

import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { MAX_ATTACHMENTS_PER_REQUEST, type FormUploadsVerdict } from "@/lib/requests/attachments";
import type { AttachmentUploads } from "@/lib/requests/use-attachment-uploads";

import { AttachmentList } from "./attachment-list";
import { AttachmentsHeading } from "./attachment-section";
import { AttachmentUploader } from "./attachment-uploader";

export function SentPanel({
  verdict,
  uploads,
  readFailed,
  retrying,
  onRetry,
}: {
  verdict: FormUploadsVerdict;
  uploads: AttachmentUploads;
  readFailed: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const labels = t.newRequest;
  const primary = useTone("primary");

  return (
    <View testID="new-request-sent" className="gap-6">
      <View className="flex-row items-start gap-3 rounded-[24px] bg-card px-4 py-4">
        <View
          className={cn(
            "h-9 w-9 items-center justify-center rounded-full",
            verdict === "problems" ? "bg-danger-soft" : "bg-accent"
          )}
        >
          {verdict === "settling" ? (
            <ActivityIndicator color={primary} />
          ) : verdict === "clean" ? (
            <Icon icon={CheckIcon} tone="primary" size={18} weight="bold" />
          ) : (
            <Icon icon={WarningCircleIcon} tone="danger" size={20} weight="bold" />
          )}
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-[16px] font-semibold text-foreground">{labels.submitted}</Text>
          <Text
            testID="new-request-sent-status"
            accessibilityLiveRegion="polite"
            className="text-[14px] leading-5 text-muted-foreground"
          >
            {verdict === "settling"
              ? labels.uploadingFiles
              : verdict === "clean"
                ? labels.uploadsAccepted
                : labels.uploadProblems}
          </Text>
        </View>
      </View>
      {readFailed ? (
        <View testID="new-request-sent-failed">
          <Notice
            tone="error"
            message={labels.uploadsUnreadable}
            action={
              retrying
                ? undefined
                : { label: labels.retry, onPress: onRetry, testID: "new-request-sent-retry" }
            }
          />
        </View>
      ) : null}
      <View>
        <AttachmentsHeading used={MAX_ATTACHMENTS_PER_REQUEST - uploads.remaining} />
        <View className="overflow-hidden rounded-[24px] bg-card">
          <AttachmentList attachments={uploads.settled} failedIds={uploads.failedIds} />
          <AttachmentUploader uploads={uploads} leadingDivider={uploads.settled.length > 0} />
        </View>
      </View>
    </View>
  );
}
