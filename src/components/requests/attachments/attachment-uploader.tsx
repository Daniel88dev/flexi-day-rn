import { PaperclipIcon, XIcon } from "phosphor-react-native";
import { Fragment, useEffect } from "react";
import { ActionSheetIOS, Alert, Linking, Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  chooseFiles,
  choosePhotos,
  takePhoto,
  type SourcePick,
} from "@/lib/requests/attachment-sources";
import { sweepPickedCopies } from "@/lib/requests/attachment-files";
import { formatFileSize } from "@/lib/requests/attachments";
import type { AttachmentUploads, UploadJob } from "@/lib/requests/use-attachment-uploads";

import { AttachmentRow, RowAction } from "./attachment-row";

type Source = "camera" | "photos" | "files";

function askForSource(labels: Dictionary["attachments"], onPick: (source: Source) => void) {
  const sources: Source[] = ["camera", "photos", "files"];
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: labels.sourceTitle,
      options: [labels.takePhoto, labels.choosePhoto, labels.chooseFile, labels.cancel],
      cancelButtonIndex: sources.length,
    },
    (index) => {
      const source = sources[index];
      if (source) onPick(source);
    }
  );
}

async function pickFrom(source: Source, openSlots: number): Promise<SourcePick> {
  if (source === "camera") return takePhoto();
  if (source === "photos") return choosePhotos(openSlots);
  return chooseFiles();
}

function jobMeta(job: UploadJob, t: Dictionary): string {
  if (job.error) return formatFileSize(job.size, t.common.locale);
  if (job.queued) return `${formatFileSize(job.size, t.common.locale)} · ${t.attachments.waiting}`;
  const percent = Math.round(job.progress * 100);
  return percent < 100 ? t.attachments.uploading(percent) : t.attachments.processing;
}

export function AttachmentUploader({
  uploads,
  disabled = false,
  leadingDivider = false,
}: {
  uploads: AttachmentUploads;
  disabled?: boolean;
  leadingDivider?: boolean;
}) {
  const { t } = useTranslation();
  const labels = t.attachments;
  const inactive = disabled || uploads.full;

  useEffect(() => sweepPickedCopies(Date.now()), []);

  const add = () =>
    askForSource(labels, (source) => {
      void pickFrom(source, uploads.remaining)
        .then((pick) => {
          if (pick.kind === "picked") uploads.pick(pick.files);
          else if (pick.kind === "denied") {
            Alert.alert(labels.cameraDenied, labels.cameraDeniedBody, [
              { text: labels.cancel, style: "cancel" },
              { text: labels.openSettings, onPress: () => void Linking.openSettings() },
            ]);
          } else if (pick.kind === "unavailable") Alert.alert(labels.cameraUnavailable);
        })
        .catch((error: unknown) => console.error("The picker could not open.", error));
    });

  return (
    <>
      {uploads.jobs.map((job, index) => {
        const removable = job.queued || job.error !== undefined;
        const sending = !job.queued && job.error === undefined;
        return (
          <Fragment key={job.key}>
            {index > 0 || leadingDivider ? <View className="ml-[64px] h-px bg-border" /> : null}
            <AttachmentRow
              testID="attachment-job"
              contentType={job.contentType}
              name={job.fileName}
              meta={jobMeta(job, t)}
              note={job.error}
              noteTone="danger"
              progress={sending ? job.progress : undefined}
              trailing={
                removable ? (
                  <RowAction
                    testID="attachment-job-remove"
                    label={job.error ? labels.dismiss(job.fileName) : labels.remove(job.fileName)}
                    icon={XIcon}
                    onPress={() => uploads.remove(job.key)}
                  />
                ) : null
              }
            />
          </Fragment>
        );
      })}
      {uploads.jobs.length > 0 || leadingDivider ? (
        <View className="ml-[64px] h-px bg-border" />
      ) : null}
      <Pressable
        testID="attachment-add"
        onPress={add}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={uploads.full ? labels.full : labels.add}
        accessibilityState={{ disabled: inactive }}
        className={cn(
          "flex-row items-center gap-3 px-4 py-3 active:opacity-60",
          inactive && "opacity-60"
        )}
      >
        <View
          className={cn(
            "h-9 w-9 items-center justify-center rounded-[16px]",
            uploads.full ? "bg-muted" : "bg-accent"
          )}
        >
          <Icon
            icon={PaperclipIcon}
            tone={uploads.full ? "faint" : "primary"}
            size={18}
            weight="bold"
          />
        </View>
        <View className="flex-1">
          <Text
            className={cn(
              "text-[15px] font-semibold",
              uploads.full ? "text-muted-foreground" : "text-primary"
            )}
          >
            {uploads.full ? labels.full : labels.add}
          </Text>
          <Text className="text-[12.5px] text-faint">
            {uploads.full ? labels.fullHint : labels.addHint}
          </Text>
        </View>
      </Pressable>
    </>
  );
}
