import { LockIcon, PencilSimpleIcon, TrashIcon } from "phosphor-react-native";
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

/** Edit and Delete for the creator or a group admin, beside a group event's card or detail. */
export function GroupEventButtons({
  testID,
  event,
  onEdit,
  onDelete,
}: {
  testID: string;
  event: CalendarGroupEvent;
  onEdit?: (event: CalendarGroupEvent) => void;
  onDelete?: (event: CalendarGroupEvent) => void;
}) {
  const { t } = useTranslation();
  if (!event.canEdit || (!onEdit && !onDelete)) return null;
  return (
    <View className="flex-row gap-2">
      {onEdit ? (
        <Pressable
          testID={`${testID}-edit`}
          onPress={() => onEdit(event)}
          accessibilityRole="button"
          accessibilityLabel={`${t.groupEvents.edit}, ${event.title}`}
          className="h-8 flex-row items-center gap-1.5 rounded-full border border-input px-3 active:opacity-70"
        >
          <Icon icon={PencilSimpleIcon} tone="foreground" size={14} />
          <Text className="text-[13px] font-semibold text-foreground">{t.groupEvents.edit}</Text>
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          testID={`${testID}-delete`}
          onPress={() => onDelete(event)}
          accessibilityRole="button"
          accessibilityLabel={`${t.groupEvents.delete}, ${event.title}`}
          className="h-8 flex-row items-center gap-1.5 rounded-full border border-input px-3 active:opacity-70"
        >
          <Icon icon={TrashIcon} tone="danger" size={14} />
          <Text className="text-[13px] font-semibold text-danger">{t.groupEvents.delete}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One group event in the day list; a tap opens its detail. */
export function GroupEventCard({
  event,
  viewerId,
  onPress,
  onEdit,
  onDelete,
}: {
  event: CalendarGroupEvent;
  viewerId: string | null;
  onPress?: (event: CalendarGroupEvent) => void;
  onEdit?: (event: CalendarGroupEvent) => void;
  onDelete?: (event: CalendarGroupEvent) => void;
}) {
  const { t } = useTranslation();
  const meta = useEventMeta(event);
  const addedBy = `${addedByLabel(event.creator, viewerId, t)} · ${event.groupName}`;
  const lock = event.canEdit ? null : lockLabel(event.creator, t);

  const testID = `day-list-event-${event.id}-${event.startDate}`;

  return (
    <View className="mb-1.5 rounded-[16px] border border-border">
      <Pressable
        testID={testID}
        onPress={onPress ? () => onPress(event) : undefined}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={[event.title, meta, event.note, addedBy, lock]
          .filter(Boolean)
          .join(", ")}
        className="flex-row gap-3 rounded-[16px] px-3 py-2.5 active:bg-muted"
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
      {event.canEdit && (onEdit || onDelete) ? (
        <View className="-mt-1 pb-2.5 pl-[34px]">
          <GroupEventButtons testID={testID} event={event} onEdit={onEdit} onDelete={onDelete} />
        </View>
      ) : null}
    </View>
  );
}
