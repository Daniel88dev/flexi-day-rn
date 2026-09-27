import {
  ChatCircleIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  PaperclipIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { View } from "react-native";

import { Icon, type Tone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { TimelineEntry, TimelineKind } from "@/lib/requests/timeline";

const EVENT_LOOKS: Record<TimelineKind, { icon: PhosphorIcon; tone: Tone; surface: string }> = {
  CREATED: { icon: PlusIcon, tone: "muted", surface: "bg-muted" },
  APPROVED: { icon: CheckIcon, tone: "ok", surface: "bg-ok-soft" },
  REJECTED: { icon: XIcon, tone: "danger", surface: "bg-danger-soft" },
  CANCELLED: { icon: ClockCounterClockwiseIcon, tone: "warm", surface: "bg-warm-soft" },
  COMMENT: { icon: ChatCircleIcon, tone: "primary", surface: "bg-accent" },
  UPDATED: { icon: PencilSimpleIcon, tone: "muted", surface: "bg-muted" },
  ATTACHMENT_ADDED: { icon: PaperclipIcon, tone: "muted", surface: "bg-muted" },
  ATTACHMENT_REMOVED: { icon: TrashIcon, tone: "warm", surface: "bg-warm-soft" },
};

export function DetailTimeline({ entries }: { entries: readonly TimelineEntry[] }) {
  const { t } = useTranslation();
  const labels = t.requestDetail;

  if (entries.length === 0) {
    return <Text className="px-1 text-[14px] text-faint">{labels.noHistory}</Text>;
  }

  const moment = (iso: string) =>
    new Date(iso).toLocaleString(t.common.locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <View testID="request-timeline" className="rounded-[24px] bg-card px-4 py-2">
      {entries.map((entry, index) => {
        const looks = EVENT_LOOKS[entry.kind];
        const by =
          entry.actor.kind === "named"
            ? labels.byActor(entry.actor.user.name)
            : entry.actor.kind === "unnamed"
              ? labels.byAdmin
              : "";
        const last = index === entries.length - 1;
        return (
          <View key={entry.id} testID={`timeline-${entry.id}`} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={cn(
                  "mt-2.5 h-7 w-7 items-center justify-center rounded-full",
                  looks.surface
                )}
              >
                <Icon icon={looks.icon} tone={looks.tone} size={14} weight="bold" />
              </View>
              {last ? null : <View className="w-px flex-1 bg-border" />}
            </View>
            <View className="flex-1 pt-2.5 pb-3">
              <Text className="text-[15px] text-foreground">
                <Text className="text-[15px] font-semibold text-foreground">
                  {labels.events[entry.kind]}
                </Text>
                <Text className="text-[15px] text-muted-foreground">{by}</Text>
              </Text>
              <Text className="mt-0.5 text-[12.5px] text-faint">{moment(entry.createdAt)}</Text>
              {entry.fileName ? (
                <Text className="mt-1 text-[13.5px] text-muted-foreground" numberOfLines={1}>
                  {entry.fileName}
                </Text>
              ) : null}
              {entry.reason ? (
                <Text className="mt-1.5 text-[14.5px] leading-5 text-foreground">
                  “{entry.reason}”
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
