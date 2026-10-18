import { LockIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { addedByLabel, lockLabel, ruleSummary, timeLabel } from "@/lib/group-events/labels";
import type { CalendarGroupEvent } from "@/lib/local-store";

/** `HH:MM–HH:MM · Every week on Mon`, the card's second line. */
export function useEventMeta(event: CalendarGroupEvent): string {
  const { t } = useTranslation();
  return [
    timeLabel(event, t),
    event.repeat ? ruleSummary(event.ruleStartDate, event.repeat, t) : null,
    event.changedOnce ? t.groupEvents.changedOnce : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** One group event in the day list; a tap opens its detail. */
export function GroupEventCard({
  event,
  viewerId,
  onPress,
}: {
  event: CalendarGroupEvent;
  viewerId: string | null;
  onPress?: (event: CalendarGroupEvent) => void;
}) {
  const { t } = useTranslation();
  const meta = useEventMeta(event);
  const addedBy = `${addedByLabel(event.creator, viewerId, t)} · ${event.groupName}`;
  const lock = event.canEdit ? null : lockLabel(event.creator, t);

  return (
    <Pressable
      testID={`day-list-event-${event.id}-${event.startDate}`}
      onPress={onPress ? () => onPress(event) : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={[event.title, meta, event.note, addedBy, lock].filter(Boolean).join(", ")}
      className="mb-1.5 flex-row gap-3 rounded-[16px] border border-border px-3 py-2.5 active:bg-muted"
    >
      <View className="mt-1.5 h-2.5 w-2.5 rounded-full bg-foreground" />
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {event.title}
        </Text>
        <Text className="text-[12.5px] text-muted-foreground" numberOfLines={2}>
          {meta}
        </Text>
        {event.note ? (
          <Text className="text-[12.5px] text-faint" numberOfLines={2}>
            {event.note}
          </Text>
        ) : null}
        <Text className="text-[11.5px] text-faint" numberOfLines={1}>
          {addedBy}
        </Text>
        {lock ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Icon icon={LockIcon} tone="faint" size={12} />
            <Text className="flex-1 text-[11.5px] text-faint">{lock}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
